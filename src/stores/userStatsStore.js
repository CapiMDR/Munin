const fs = require("fs");
const path = require("path");
const { getMexicoCityDateKey, getMexicoCityWeekKey } = require("../utils/timeUtils");

const LIFETIME_FIELDS = [
  "messages",
  "nightMessages",
  "repliesSent",
  "mentionsSent",
  "mentionsReceived",
  "muninMentions",
  "stickers",
  "images",
  "voiceNotes",
  "words",
  "feathers",
  "commandsUsed",
  "remindersCreated",
  "messagesSaved",
  "pollsCreated",
];
const DAILY_FIELDS = [
  "messages",
  "nightMessages",
  "repliesSent",
  "mentionsSent",
  "mentionsReceived",
  "muninMentions",
  "stickers",
  "images",
  "voiceNotes",
  "words",
  "feathers",
];
const TRIVIA_LIFETIME_FIELDS = ["gamesPlayed", "gamesWon", "questionsAnswered", "correctAnswers", "currentCorrectStreak", "bestCorrectStreak"];
const TRIVIA_DAILY_FIELDS = ["gamesPlayed", "gamesWon", "questionsAnswered", "correctAnswers"];

class UserStatsStore {
  constructor(filePath = path.join(__dirname, "..", "..", "data", "userStats.json")) {
    this.filePath = filePath;
    this.data = this.load();
  }

  load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error("The user stats file must contain an object.");
      return data.groups && typeof data.groups === "object" && !Array.isArray(data.groups) ? data : { groups: {}, legacyGlobalStats: data };
    } catch (error) {
      if (error.code === "ENOENT") return { groups: {} };
      throw error;
    }
  }

  recordMessage(
    chatId,
    {
      mentionId,
      name,
      replyToMentionId,
      isReply = false,
      mentionedIds = [],
      mentionedUsers = [],
      botMentionId,
      isSticker = false,
      isImage = false,
      isVoiceNote = false,
      isNightMessage = false,
      words = 0,
      isCommand = false,
    },
  ) {
    if (!chatId || !mentionId) return undefined;

    const group = this.getGroup(chatId);
    const sender = this.getProfile(group, mentionId, name);
    this.increment(sender, "messages");
    this.increment(sender, "words", words);
    if (isSticker) this.increment(sender, "stickers");
    if (isImage) this.increment(sender, "images");
    if (isVoiceNote) this.increment(sender, "voiceNotes");
    if (isNightMessage) this.increment(sender, "nightMessages");
    if (isCommand) this.increment(sender, "commandsUsed", 1, false);
    if (isReply || replyToMentionId) this.increment(sender, "repliesSent");

    const humanMentions = mentionedIds.filter((id) => id && id !== botMentionId);
    if (humanMentions.length) {
      this.increment(sender, "mentionsSent", humanMentions.length);
      humanMentions.forEach((id) => {
        const mentionedUser = mentionedUsers.find((user) => user.mentionId === id);
        this.increment(this.getProfile(group, id, mentionedUser?.name), "mentionsReceived");
      });
    }
    const muninMentions = mentionedIds.filter((id) => id === botMentionId).length;
    if (muninMentions) this.increment(sender, "muninMentions", muninMentions);

    sender.records.longestMessage = Math.max(sender.records.longestMessage, words);
    this.updateStreak(group, mentionId, sender);
    this.save();
    return this.snapshot(sender);
  }

  recordAction(chatId, mentionId, action) {
    if (!chatId || !mentionId || !["remindersCreated", "messagesSaved", "pollsCreated"].includes(action)) return undefined;
    const profile = this.getProfile(this.getGroup(chatId), mentionId);
    this.increment(profile, action, 1, false);
    this.save();
    return this.snapshot(profile);
  }

  canReceiveFeather(chatId, mentionId, now = Date.now()) {
    const profile = this.data.groups[chatId]?.users?.[mentionId];
    return !profile || (profile.featherCooldownUntil || 0) <= now;
  }

  recordFeather(chatId, mentionId, cooldownMs = 0) {
    if (!chatId || !mentionId) return undefined;
    const profile = this.getProfile(this.getGroup(chatId), mentionId);
    this.increment(profile, "feathers");
    profile.featherCooldownUntil = Date.now() + cooldownMs;
    this.save();
    return this.snapshot(profile);
  }

  recordTriviaGamePlayed(chatId, mentionId) {
    return this.recordTrivia(chatId, mentionId, (profile) => this.incrementTrivia(profile, "gamesPlayed"));
  }

  recordTriviaAnswer(chatId, mentionId, correct) {
    return this.recordTrivia(chatId, mentionId, (profile) => {
      this.incrementTrivia(profile, "questionsAnswered");
      if (!correct) {
        profile.lifetime.trivia.currentCorrectStreak = 0;
        profile.weekly.trivia.currentCorrectStreak = 0;
        return;
      }
      this.incrementTrivia(profile, "correctAnswers");
      profile.lifetime.trivia.currentCorrectStreak += 1;
      profile.weekly.trivia.currentCorrectStreak += 1;
      profile.lifetime.trivia.bestCorrectStreak = Math.max(profile.lifetime.trivia.bestCorrectStreak, profile.lifetime.trivia.currentCorrectStreak);
      profile.weekly.trivia.bestCorrectStreak = Math.max(profile.weekly.trivia.bestCorrectStreak, profile.weekly.trivia.currentCorrectStreak);
    });
  }

  recordTriviaGameWon(chatId, mentionId) {
    return this.recordTrivia(chatId, mentionId, (profile) => this.incrementTrivia(profile, "gamesWon"));
  }

  recordTrivia(chatId, mentionId, update) {
    if (!chatId || !mentionId) return undefined;
    const profile = this.getProfile(this.getGroup(chatId), mentionId);
    update(profile);
    this.save();
    return this.snapshot(profile);
  }

  get(chatId, mentionId) {
    const group = this.data.groups[chatId];
    if (!group) return undefined;
    const profile = this.getGroup(chatId).users[mentionId];
    return profile && this.snapshot(this.normalizeProfile(profile));
  }

  getGroupReport(chatId) {
    const group = this.data.groups[chatId];
    if (!group) return { memberCount: 0, members: [], daily: dailyCounters(), weekly: lifetimeCounters() };

    const profiles = Object.values(this.getGroup(chatId).users).map((profile) => this.normalizeProfile(profile));
    return {
      memberCount: profiles.length,
      members: profiles.map((profile) => ({ name: profile.name, weekly: profile.weekly })),
      daily: sumStatCounters(
        profiles.map((profile) => profile.daily),
        DAILY_FIELDS,
        TRIVIA_DAILY_FIELDS,
      ),
      weekly: sumStatCounters(
        profiles.map((profile) => profile.weekly),
        LIFETIME_FIELDS,
        TRIVIA_LIFETIME_FIELDS,
      ),
    };
  }

  resetWeeklyStats(chatId) {
    const group = this.data.groups[chatId];
    if (!group) return;

    Object.values(this.getGroup(chatId).users).forEach((profile) => {
      const normalized = this.normalizeProfile(profile);
      normalized.weekly = { week: getMexicoCityWeekKey(), ...lifetimeCounters() };
    });
    this.save();
  }

  getGroup(chatId) {
    const group = (this.data.groups[chatId] ||= { users: {}, streak: { mentionId: null, length: 0 } });
    if (!group.users) {
      const users = { ...group };
      delete users.dailyMessages;
      this.data.groups[chatId] = { users, streak: { mentionId: null, length: 0 } };
    }
    const normalized = this.data.groups[chatId];
    normalized.streak ||= { mentionId: null, length: 0 };
    return normalized;
  }

  getProfile(group, mentionId, name) {
    const profile = (group.users[mentionId] ||= createProfile(name || mentionId));
    if (name) profile.name = name;
    return this.normalizeProfile(profile);
  }

  normalizeProfile(profile) {
    if (!profile.lifetime) {
      profile.lifetime = lifetimeCounters({
        messages: profile.messagesSent || 0,
        repliesSent: profile.messagesRepliedTo || 0,
        muninMentions: profile.muninUses || 0,
        stickers: profile.stickersSent || 0,
      });
      delete profile.messagesSent;
      delete profile.messagesRepliedTo;
      delete profile.muninUses;
      delete profile.stickersSent;
    }
    const today = getMexicoCityDateKey();
    if (!profile.daily || profile.daily.date !== today) profile.daily = { date: today, ...dailyCounters() };
    const week = getMexicoCityWeekKey();
    if (!profile.weekly) profile.weekly = { week, ...lifetimeCounters(profile.daily) };
    else if (profile.weekly.week !== week) profile.weekly = { week, ...lifetimeCounters() };
    profile.records ||= { longestMessage: 0, longestStreak: 0 };
    profile.featherCooldownUntil ||= 0;
    LIFETIME_FIELDS.forEach((field) => (profile.lifetime[field] ||= 0));
    DAILY_FIELDS.forEach((field) => (profile.daily[field] ||= 0));
    LIFETIME_FIELDS.forEach((field) => (profile.weekly[field] ||= 0));
    profile.lifetime.trivia ||= triviaCounters(TRIVIA_LIFETIME_FIELDS);
    profile.daily.trivia ||= triviaCounters(TRIVIA_DAILY_FIELDS);
    profile.weekly.trivia ||= triviaCounters(TRIVIA_LIFETIME_FIELDS);
    normalizeTrivia(profile.lifetime.trivia, TRIVIA_LIFETIME_FIELDS);
    normalizeTrivia(profile.daily.trivia, TRIVIA_DAILY_FIELDS);
    normalizeTrivia(profile.weekly.trivia, TRIVIA_LIFETIME_FIELDS);
    return profile;
  }

  increment(profile, field, amount = 1, includeDaily = true) {
    profile.lifetime[field] += amount;
    const week = getMexicoCityWeekKey();
    if (profile.weekly.week !== week) profile.weekly = { week, ...lifetimeCounters() };
    profile.weekly[field] += amount;
    if (!includeDaily || !DAILY_FIELDS.includes(field)) return;
    const today = getMexicoCityDateKey();
    if (profile.daily.date !== today) profile.daily = { date: today, ...dailyCounters() };
    profile.daily[field] += amount;
  }

  incrementTrivia(profile, field, amount = 1) {
    profile.lifetime.trivia[field] += amount;
    const week = getMexicoCityWeekKey();
    if (profile.weekly.week !== week) profile.weekly = { week, ...lifetimeCounters() };
    profile.weekly.trivia[field] += amount;
    if (!TRIVIA_DAILY_FIELDS.includes(field)) return;
    const today = getMexicoCityDateKey();
    if (profile.daily.date !== today) profile.daily = { date: today, ...dailyCounters() };
    profile.daily.trivia[field] += amount;
  }

  updateStreak(group, mentionId, profile) {
    group.streak.length = group.streak.mentionId === mentionId ? group.streak.length + 1 : 1;
    group.streak.mentionId = mentionId;
    profile.records.longestStreak = Math.max(profile.records.longestStreak, group.streak.length);
  }

  snapshot(profile) {
    return JSON.parse(JSON.stringify(this.normalizeProfile(profile)));
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }
}

function createProfile(name) {
  return {
    name,
    lifetime: lifetimeCounters(),
    daily: { date: getMexicoCityDateKey(), ...dailyCounters() },
    records: { longestMessage: 0, longestStreak: 0 },
  };
}

function lifetimeCounters(initial = {}) {
  return { ...counters(LIFETIME_FIELDS, initial), trivia: triviaCounters(TRIVIA_LIFETIME_FIELDS, initial.trivia) };
}

function dailyCounters(initial = {}) {
  return { ...counters(DAILY_FIELDS, initial), trivia: triviaCounters(TRIVIA_DAILY_FIELDS, initial.trivia) };
}

function triviaCounters(fields, initial = {}) {
  return counters(fields, initial);
}

function normalizeTrivia(trivia, fields) {
  if (!trivia || typeof trivia !== "object") return;
  fields.forEach((field) => (trivia[field] ||= 0));
}

function counters(fields, initial = {}) {
  return Object.fromEntries(fields.map((field) => [field, initial[field] || 0]));
}

function sumCounters(counterSets, fields) {
  return counterSets.reduce((total, values) => {
    fields.forEach((field) => (total[field] += values[field] || 0));
    return total;
  }, counters(fields));
}

function sumStatCounters(counterSets, fields, triviaFields) {
  const total = sumCounters(counterSets, fields);
  total.trivia = sumCounters(
    counterSets.map((values) => values.trivia || {}),
    triviaFields,
  );
  return total;
}

module.exports = UserStatsStore;
