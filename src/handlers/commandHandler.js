const PendingStore = require("../stores/pendingStore");
const ReminderStore = require("../stores/reminderStore");
const ClassStore = require("../stores/classStore");
const AdminStore = require("../stores/adminStore");
const CustomCommandStore = require("../stores/customCommandStore");
const SavedMessageStore = require("../stores/savedMessageStore");
const pendingService = require("../services/pendingService");
const reminderService = require("../services/reminderService");
const savedMessageService = require("../services/savedMessageService");
const { presentPendingResult } = require("../presenters/pendingPresenter");
const { presentSavedMessageResult } = require("../presenters/savedMessagePresenter");
const { presentReminderResult } = require("../presenters/reminderPresenter");
const { presentGroupReport } = require("../presenters/groupReportPresenter");
const { presentClassResult } = require("../presenters/classPresenter");
const customCommandService = require("../services/customCommandService");
const { presentCustomCommandResult } = require("../presenters/customCommandPresenter");
const { presentWeatherResult } = require("../presenters/weatherPresenter");
const { presentTriviaResult } = require("../presenters/triviaPresenter");
const statsService = require("../services/statsService");
const { presentStatsResult } = require("../presenters/statsPresenter");
const helpService = require("../services/helpService");
const { presentHelpResult } = require("../presenters/helpPresenter");
const animalImageService = require("../services/animalImageService");
const { presentAnimalImageResult } = require("../presenters/animalImagePresenter");
const summaryService = require("../services/summaryService");
const { presentSummaryResult } = require("../presenters/summaryPresenter");
const classService = require("../services/classService");
const triviaService = require("../services/triviaService");
const weatherService = require("../services/weatherService");
const { parsePendingDate, parsePendingTime } = require("../utils/pendingUtils");
const { resolveMexicoCityDate } = require("../utils/dateUtils");
const { DAYS_ORDER, getDays } = require("../utils/timeUtils");
const { COIN_SIDES, COMMANDS, EIGHT_BALL_RESPONSES, INFINITE_TOKEN } = require("../config/commandConstants");
const { MESSAGES } = require("../presenters/messages");
const {
  formatDuration,
  formatRemainingDuration,
  formatTimerDuration,
  getMexicoCityTime,
  parseDuration,
  parseTimeRange,
  parseTimerDuration,
  timeToMinutes,
} = require("../utils/timeUtils");

class CommandHandler {
  /** Inputs: injected messaging, storage, and scheduler dependencies. Initializes the handler. Output: a configured instance. */
  constructor({
    sendMessage,
    pendingStore = new PendingStore(),
    reminderStore = new ReminderStore(),
    reminderScheduler,
    sendPoll,
    classStore = new ClassStore(),
    classScheduler,
    scheduleTimer,
    adminStore = new AdminStore(),
    customCommandStore = new CustomCommandStore(),
    savedMessageStore = new SavedMessageStore(),
    getBotLid = () => undefined,
    summarizer,
    generateSummary,
    suggestSimilarCommand,
    userStatsStore,
    weeklyReportStore,
    sendAnimalImage,
    openMeteoApi,
    openTriviaApi,
    translateTrivia,
    triviaManager,
  } = {}) {
    Object.assign(this, {
      sendMessage,
      pendingStore,
      reminderStore,
      reminderScheduler,
      sendPoll,
      classStore,
      classScheduler,
      scheduleTimer,
      adminStore,
      customCommandStore,
      savedMessageStore,
      getBotLid,
      summarizer,
      generateSummary,
      suggestSimilarCommand,
      userStatsStore,
      weeklyReportStore,
      sendAnimalImage,
      openMeteoApi,
      openTriviaApi,
      translateTrivia,
      triviaManager,
    });
  }

  /** Inputs: WhatsApp message, chat ID, optional quote, sender, serialized message ID, and normalized command text. Dispatches a command. Output: a resolved command response. */
  async handleCommand(message, chatId, quotedMessage, sender, messageId, commandText = message.body) {
    const [command, ...args] = commandText.trim().split(/\s+/);
    if (this.adminStore.isBanned(chatId, sender?.mentionId)) return;
    if (this.adminStore.isPaused(chatId) && !this.adminStore.isAdmin(chatId, sender?.mentionId)) return;
    const commandKey = command.toLowerCase();
    const handlers = this.getHandlers();
    const handler = handlers[commandKey] || (this.customCommandStore.has(chatId, commandKey) ? this.handleCustomCommand : this.handleUnknown);
    await handler.call(this, chatId, args, quotedMessage, sender, command, message, messageId, this.getBotLid());
  }

  /** Inputs: none. Builds command-to-method routing. Output: an object of command handlers. */
  getHandlers() {
    return {
      [COMMANDS.MUNIN]: this.handleMunin,
      [COMMANDS.PING]: this.handlePing,
      [COMMANDS.ECHO]: this.handleEcho,
      [COMMANDS.CREATE_CUSTOM_COMMAND]: this.handleCreateCustomCommand,
      [COMMANDS.LIST_CUSTOM_COMMANDS]: this.handleListCustomCommands,
      [COMMANDS.SAVE_MESSAGE]: this.handleSaveMessage,
      [COMMANDS.VIEW_SAVED_MESSAGE]: this.handleViewSavedMessage,
      [COMMANDS.LIST_SAVED_MESSAGES]: this.handleListSavedMessages,
      [COMMANDS.DELETE_SAVED_MESSAGE]: this.handleDeleteSavedMessage,
      [COMMANDS.PENDING]: this.handlePending,
      [COMMANDS.REMINDER]: this.handleReminder,
      [COMMANDS.COIN]: this.handleCoin,
      [COMMANDS.DICE]: this.handleDice,
      [COMMANDS.EIGHT_BALL]: this.handleEightBall,
      [COMMANDS.RANDOM]: this.handleRandom,
      [COMMANDS.POLL]: this.handlePoll,
      [COMMANDS.MULTIPLE_POLL]: this.handlePoll,
      [COMMANDS.TIMER]: this.handleTimer,
      [COMMANDS.SUMMARY]: this.handleSummary,
      [COMMANDS.BAN]: this.handleBan,
      [COMMANDS.CONFIG]: this.handleConfig,
      [COMMANDS.UNBAN]: this.handleUnban,
      [COMMANDS.ADMIN]: this.handleAdmin,
      [COMMANDS.NO_ADMIN]: this.handleNoAdmin,
      [COMMANDS.PAUSE]: this.handlePause,
      [COMMANDS.UNPAUSE]: this.handleUnpause,
      [COMMANDS.CURRENT_CLASS]: this.handleCurrentClass,
      [COMMANDS.LIST_CLASSES_TODAY]: this.handleClassesToday,
      [COMMANDS.LIST_ALL_CLASSES]: this.handleAllClasses,
      [COMMANDS.ADD_CLASS]: this.handleAddClass,
      [COMMANDS.EDIT_CLASS]: this.handleEditClass,
      [COMMANDS.DELETE_CLASS]: this.handleDeleteClass,
      [COMMANDS.BELL]: this.handleBell,
      [COMMANDS.HELP]: this.handleHelp,
      [COMMANDS.STATS]: this.handleStats,
      [COMMANDS.REPORT]: this.handleReport,
      [COMMANDS.USE_REPORT]: this.handleToggleWeeklyReport,
      [COMMANDS.CAT]: this.handleCat,
      [COMMANDS.DOG]: this.handleDog,
      [COMMANDS.WEATHER]: this.handleWeather,
      [COMMANDS.TRIVIA]: this.handleTrivia,
    };
  }

  /** Inputs: chat ID. Sends the greeting. Output: the sent-message promise. */
  async handleMunin(chatId) {
    await this.sendMessage(chatId, MESSAGES.WELCOME);
  }
  /** Inputs: chat ID. Sends the ping response. Output: the sent-message promise. */
  async handlePing(chatId) {
    await this.sendMessage(chatId, MESSAGES.PONG);
  }
  /** Inputs: chat ID and text arguments. Echoes text. Output: the sent-message promise. */
  async handleEcho(chatId, args) {
    await this.sendMessage(chatId, args.join(" "));
  }
  /** Inputs: chat ID, requested message count, and the command message. Summarizes recent prior group messages with the LLM. Output: the sent-message promise. */
  async handleSummary(chatId, args, quotedMessage, sender, command, message) {
    if (typeof this.generateSummary !== "function") {
      return this.sendMessage(chatId, MESSAGES.SUMMARY_UNAVAILABLE);
    }
    const amount = Number(args[0]);
    const result = summaryService.prepareSummary(
      { chatId, amount: args.length === 1 ? amount : undefined, excludedMessage: message },
      this.summarizer,
    );
    const presentation = presentSummaryResult(result);
    if (!presentation.ok) return this.sendMessage(chatId, presentation.message);
    const summary = await this.generateSummary(presentation.conversation);
    await this.sendMessage(chatId, summary || MESSAGES.SUMMARY_UNAVAILABLE);
  }
  /** Inputs: chat ID, command name, and reply arguments. Creates or updates a group-specific custom command. Output: confirmation or usage response. */
  async handleCreateCustomCommand(chatId, args) {
    if (args[0] === "-") return this.handleDeleteCustomCommand(chatId, args.slice(1));

    const result = customCommandService.createCustomCommand(
      { chatId, command: args[0], reply: args.slice(1).join(" "), builtInCommands: Object.keys(this.getHandlers()) },
      this.customCommandStore,
    );
    await this.sendMessage(chatId, presentCustomCommandResult(result).message);
  }
  /** Inputs: chat ID. Lists custom commands in the current group. Output: the sent-message promise. */
  async handleListCustomCommands(chatId) {
    const result = customCommandService.listCustomCommands(chatId, this.customCommandStore);
    await this.sendMessage(chatId, presentCustomCommandResult(result).message);
  }
  /** Inputs: chat ID and custom-command index. Deletes a custom command. Output: confirmation, usage, or not-found response. */
  async handleDeleteCustomCommand(chatId, args) {
    const result = customCommandService.deleteCustomCommand(
      { chatId, index: args.length === 1 ? Number(args[0]) : undefined },
      this.customCommandStore,
    );
    await this.sendMessage(chatId, presentCustomCommandResult(result).message);
  }
  /** Inputs: chat ID, command arguments, and command name. Replies with or deletes a group-specific custom command. Output: the sent-message promise. */
  async handleCustomCommand(chatId, args, quotedMessage, sender, command) {
    const commandKey = command.toLowerCase();
    if (args.length === 1 && args[0] === "-") {
      this.customCommandStore.remove(chatId, commandKey);
      return this.sendMessage(chatId, MESSAGES.CUSTOM_COMMAND_DELETED(commandKey));
    }
    await this.sendMessage(chatId, this.customCommandStore.get(chatId, commandKey));
  }
  /** Inputs: chat ID, title arguments, quoted message, command message, and serialized message ID. Saves the command message ID under a group-specific title. Output: confirmation or usage response. */
  async handleSaveMessage(chatId, args, quotedMessage, sender, command, message, messageId, botLid) {
    const title = args.join(" ").trim();

    if (!message.hasQuotedMsg) return this.sendMessage(chatId, MESSAGES.SAVE_MESSAGE_USAGE);
    const savedMessage = savedMessageService.saveMessage(
      {
        chatId,
        title,
        quotedStanzaId: message._data?.quotedStanzaID,
        quotedParticipant: message._data?.quotedParticipant,
        botLid,
        senderMentionId: sender?.mentionId,
      },
      this.savedMessageStore,
      this.userStatsStore,
    );
    const presentation = presentSavedMessageResult(savedMessage, { title });
    await this.sendMessage(chatId, presentation.message);
  }
  /** Inputs: chat ID and title arguments. Sends a bot message quoting the saved command message. Output: confirmation or not-found response. */
  async handleViewSavedMessage(chatId, args) {
    const title = args.join(" ").trim();

    if (!title) {
      return this.sendMessage(chatId, MESSAGES.VIEW_SAVED_MESSAGE_USAGE);
    }

    const result = savedMessageService.getSavedMessage(chatId, title, this.savedMessageStore);

    const presentation = presentSavedMessageResult(result, { title });
    await this.sendMessage(chatId, presentation.message, presentation.sendOptions);
  }
  /** Inputs: chat ID. Lists saved message titles for the current group. Output: the sent-message promise. */
  async handleListSavedMessages(chatId) {
    const result = savedMessageService.listSavedMessages(chatId, this.savedMessageStore);
    const presentation = presentSavedMessageResult(result);
    await this.sendMessage(chatId, presentation.message);
  }
  /** Inputs: chat ID and saved-message index. Deletes a saved message from the current group. Output: confirmation, usage, or not-found response. */
  async handleDeleteSavedMessage(chatId, args) {
    const index = Number(args[0]);
    if (args.length !== 1 || !Number.isInteger(index) || index < 1) return this.sendMessage(chatId, MESSAGES.DELETE_SAVED_MESSAGE_USAGE);
    const result = savedMessageService.deleteSavedMessage(chatId, index - 1, this.savedMessageStore);
    const presentation = presentSavedMessageResult(result);
    await this.sendMessage(chatId, result.ok ? presentation.message : MESSAGES.SAVED_MESSAGE_INDEX_NOT_FOUND);
  }
  /** Inputs: chat ID and an optional help-page number. Sends the requested help page. Output: the sent-message promise. */
  async handleHelp(chatId, args) {
    const presentation = presentHelpResult(helpService.getHelp({ page: args.length === 0 ? 1 : args.length === 1 ? Number(args[0]) : undefined }));
    await this.sendMessage(chatId, presentation.message);
  }
  /** Inputs: chat ID, sender, and command message. Shows mentioned-user activity or the sender's when no one is mentioned. Output: the sent-message promise. */
  async handleStats(chatId, args, quotedMessage, sender, command, message) {
    const mentionedContacts = await message.getMentions();

    if (mentionedContacts.length > 1) {
      return this.sendMessage(chatId, MESSAGES.STATS_USAGE);
    }

    let targetMentionId = sender?.mentionId;

    if (mentionedContacts.length === 1) {
      const contact = mentionedContacts[0];
      targetMentionId = contact?.id?._serialized ?? contact?.id?.$1;
    }

    const presentation = presentStatsResult(statsService.getUserStats({ chatId, mentionId: targetMentionId }, this.userStatsStore));
    await this.sendMessage(chatId, presentation.message);
  }
  /** Inputs: chat ID. Shows the current week's stored group activity and current open-item totals. Output: the sent-message promise. */
  async handleReport(chatId) {
    const report = this.userStatsStore?.getGroupReport(chatId) || emptyGroupReport();
    report.currentPendings = this.pendingStore.getAll(chatId).length;
    await this.sendMessage(chatId, presentGroupReport(report));
  }
  /** Inputs: chat ID. Toggles the group's automatic Sunday weekly report. Output: the sent-message promise. */
  async handleToggleWeeklyReport(chatId) {
    const enabled = this.weeklyReportStore?.toggle(chatId);
    await this.sendMessage(chatId, enabled ? MESSAGES.WEEKLY_REPORT_ENABLED : MESSAGES.WEEKLY_REPORT_DISABLED);
  }
  /** Inputs: chat ID. Fetches and sends a random cat image. Output: the sent-message promise. */
  async handleCat(chatId) {
    await this.handleAnimalImage(chatId, "cat", MESSAGES.CAT_UNAVAILABLE);
  }
  /** Inputs: chat ID. Fetches and sends a random dog image. Output: the sent-message promise. */
  async handleDog(chatId) {
    await this.handleAnimalImage(chatId, "dog", MESSAGES.DOG_UNAVAILABLE);
  }
  async handleAnimalImage(chatId, animal, unavailableMessage) {
    const presentation = presentAnimalImageResult(await animalImageService.sendAnimalImage({ chatId, animal }, this.sendAnimalImage), animal);
    if (!presentation.ok) await this.sendMessage(chatId, presentation.message || unavailableMessage);
  }
  /** Inputs: chat ID and optional dd/mm date. Sends the daily forecast for Munin's configured location. Output: the sent-message promise. */
  async handleWeather(chatId, args) {
    const { date, location } = splitWeatherArguments(args);
    const result = await weatherService.getWeather({ date, location }, this.openMeteoApi);
    await this.sendMessage(chatId, presentWeatherResult(result).message);
  }
  /** Inputs: chat ID and a requested trivia-question count. Fetches a batch and sends its first question with shuffled answers. Output: the sent-message promise. */
  async handleTrivia(chatId, args) {
    const amount = Number(args[0]);
    if (args.length !== 1) {
      return this.sendMessage(chatId, MESSAGES.TRIVIA_USAGE);
    }
    const result = await triviaService.startTrivia({ chatId, amount }, this);
    const presentation = presentTriviaResult(result);
    if (!presentation.ok) await this.sendMessage(chatId, presentation.message);
  }
  /** Inputs: chat ID and unknown command name. Asks the LLM for a close, existing command name. Output: the sent-message promise. */
  async handleUnknown(chatId, args, quotedMessage, sender, command) {
    const availableCommands = [...Object.keys(this.getHandlers()), ...this.customCommandStore.getAll(chatId).map(({ command: name }) => name)];

    try {
      const suggestion = await this.suggestSimilarCommand?.(command.toLowerCase(), availableCommands);
      if (suggestion) return this.sendMessage(chatId, MESSAGES.SUGGEST_SIMILAR_COMMAND(suggestion));
    } catch (error) {
      console.warn("Could not suggest a similar command:", error.message);
    }

    await this.sendMessage(chatId, MESSAGES.UNKNOWN_COMMAND(command));
  }

  /** Inputs: chat ID, arguments, optional quote. Adds, lists, or deletes pending items based on the !p syntax. Output: the sent-message promise. */
  async handlePending(chatId, args, quotedMessage) {
    if (args[0] === "-") {
      return this.handleDeletePending(chatId, args.slice(1));
    }

    if (args.length === 0 && !quotedMessage?.body?.trim()) {
      return this.handleListPending(chatId);
    }

    return this.handleAddPending(chatId, args, quotedMessage);
  }

  /** Inputs: chat ID, content/date arguments, optional quote. Stores a pending item. Output: a confirmation or usage response. */
  async handleAddPending(chatId, args, quotedMessage) {
    const { date, argumentCount: dateArgumentCount } = parsePendingDateArguments(args);
    if (args[0]?.startsWith("@") && !date) return this.sendMessage(chatId, MESSAGES.PENDING_USAGE);

    const timeIndex = date ? dateArgumentCount : 0;
    const time = parsePendingTime(args[timeIndex]);
    if (/^\d{1,2}:\d{2}$/.test(args[timeIndex] || "") && !time) return this.sendMessage(chatId, MESSAGES.PENDING_USAGE);

    const pending =
      args
        .slice((date ? dateArgumentCount : 0) + (time ? 1 : 0))
        .join(" ")
        .trim() || quotedMessage?.body?.trim();
    if (!pending) return this.sendMessage(chatId, MESSAGES.PENDING_USAGE);
    const result = pendingService.createPending({ chatId, content: pending, date, time }, this.pendingStore);
    const presentation = presentPendingResult(result);
    await this.sendMessage(chatId, presentation.message);
  }

  /** Inputs: chat ID. Lists pending items for that chat. Output: the sent-message promise. */
  async handleListPending(chatId) {
    const result = pendingService.listPendings(chatId, this.pendingStore);
    await this.sendMessage(chatId, presentPendingResult(result).message);
  }

  /** Inputs: chat ID and pending-item index. Deletes a pending item. Output: confirmation or validation response. */
  async handleDeletePending(chatId, args) {
    const index = Number(args[0]);
    if (args.length !== 1 || !Number.isInteger(index) || index < 1) return this.sendMessage(chatId, MESSAGES.PENDING_USAGE);
    const result = pendingService.deletePending(chatId, index - 1, this.pendingStore);
    await this.sendMessage(chatId, presentPendingResult(result, { index }).message);
  }

  /** Inputs: chat ID, arguments, optional quote, and sender. Adds, lists, or deletes reminders based on the !r syntax. Output: the sent-message promise. */
  async handleReminder(chatId, args, quotedMessage, sender, command, message, messageId) {
    if (args[0] === "-") return this.handleDeleteReminder(chatId, args.slice(1));
    if (args.length === 0) return this.handleListReminders(chatId);

    const durationText = args[0];
    const recurrenceMatch = args[1]?.match(/^x(\d+)$/i);
    const repeatsForever = args[1]?.toLowerCase() === INFINITE_TOKEN;
    return recurrenceMatch || repeatsForever
      ? this.handleAddRecurringReminder(chatId, durationText, recurrenceMatch?.[1], args.slice(2), quotedMessage, sender, messageId)
      : this.handleAddReminder(chatId, durationText, args.slice(1), quotedMessage, sender, messageId);
  }

  /** Inputs: chat ID, duration text, content arguments, optional quote and sender. Stores and schedules a one-time reminder. Output: confirmation or usage response. */
  async handleAddReminder(chatId, durationText, contentArgs, quotedMessage, sender, messageId) {
    const content = contentArgs.join(" ").trim() || quotedMessage?.body?.trim();
    const result = reminderService.createReminder(
      { chatId, text: content, duration: durationText, messageId, senderMentionId: sender?.mentionId },
      this.reminderStore,
      this.reminderScheduler,
      this.userStatsStore,
    );
    if (!result.ok) return this.sendMessage(chatId, MESSAGES.REMINDER_USAGE);
    const presentation = presentReminderResult(result, { senderTag: sender?.tag, duration: durationText });
    await this.sendMessage(chatId, presentation.message, sender?.mentionId ? { mentions: [sender.mentionId] } : undefined);
  }
  /** Inputs: chat ID, interval text, optional repetition count, content arguments, and optional quote. Creates a recurring reminder. Output: confirmation or usage response. */
  async handleAddRecurringReminder(chatId, intervalText, repetitionCount, contentArgs, quotedMessage, sender, messageId) {
    const content = contentArgs.join(" ").trim() || quotedMessage?.body?.trim();
    const remaining = repetitionCount ? Number(repetitionCount) : null;
    const result = reminderService.createReminder(
      {
        chatId,
        text: content,
        duration: intervalText,
        repeatCount: remaining === null ? undefined : remaining,
        repeatForever: remaining === null,
        messageId,
        senderMentionId: sender?.mentionId,
      },
      this.reminderStore,
      this.reminderScheduler,
      this.userStatsStore,
    );
    if (!result.ok) return this.sendMessage(chatId, MESSAGES.REMINDER_USAGE);
    const repetitions = remaining === null ? "infinitas veces" : `${remaining} veces`;
    await this.sendMessage(chatId, presentReminderResult(result, { duration: intervalText, repetitions }).message);
  }

  /** Inputs: chat ID. Lists reminders for that chat. Output: the sent-message promise. */
  async handleListReminders(chatId) {
    const result = reminderService.listReminders(chatId, this.reminderStore);
    await this.sendMessage(chatId, presentReminderResult(result).message);
  }
  /** Inputs: chat ID and reminder index. Cancels and deletes a reminder. Output: confirmation or validation response. */
  async handleDeleteReminder(chatId, args) {
    const index = Number(args[0]);
    if (args.length !== 1 || !Number.isInteger(index) || index < 1) return this.sendMessage(chatId, MESSAGES.REMINDER_USAGE);
    const result = reminderService.deleteReminder(chatId, index - 1, this.reminderStore, this.reminderScheduler);
    await this.sendMessage(chatId, presentReminderResult(result, { index }).message);
  }

  /** Inputs: chat ID. Selects a random coin side. Output: the sent-message promise. */
  async handleCoin(chatId) {
    await this.sendMessage(chatId, MESSAGES.COIN_RESULT(COIN_SIDES[Math.floor(Math.random() * COIN_SIDES.length)]));
  }
  /** Inputs: chat ID. Rolls a random die result. Output: the sent-message promise. */
  async handleDice(chatId) {
    await this.sendMessage(chatId, MESSAGES.DICE_RESULT(Math.floor(Math.random() * 6) + 1));
  }
  /** Inputs: chat ID. Selects a random eight-ball response. Output: the sent-message promise. */
  async handleEightBall(chatId) {
    await this.sendMessage(chatId, MESSAGES.EIGHT_BALL_RESULT(EIGHT_BALL_RESPONSES[Math.floor(Math.random() * EIGHT_BALL_RESPONSES.length)]));
  }

  /** Inputs: chat ID and comma-separated options. Selects one option. Output: result or usage response. */
  async handleRandom(chatId, args) {
    const options = args
      .join(" ")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (options.length < 2) return this.sendMessage(chatId, MESSAGES.RANDOM_USAGE);
    await this.sendMessage(chatId, MESSAGES.RANDOM_RESULT(options[Math.floor(Math.random() * options.length)]));
  }

  /** Inputs: chat ID, comma-separated title/options, and poll command. Creates a single or multiple-choice poll. Output: sent-poll or usage promise. */
  async handlePoll(chatId, args, quotedMessage, sender, command) {
    const [title, ...options] = args
      .join(" ")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (options.length < 2) return this.sendMessage(chatId, MESSAGES.POLL_USAGE);
    await this.sendPoll(chatId, title, options, command.toLowerCase() === COMMANDS.MULTIPLE_POLL);
    this.userStatsStore?.recordAction(chatId, sender?.mentionId, "pollsCreated");
  }

  /** Inputs: chat ID and a s/m/h duration. Schedules a one-shot timer. Output: confirmation or usage response. */
  async handleTimer(chatId, args) {
    const durationText = args[0];
    const duration = parseTimerDuration(durationText);
    if (args.length !== 1 || !duration) return this.sendMessage(chatId, MESSAGES.TIMER_USAGE);
    this.scheduleTimer?.(duration, () => this.sendMessage(chatId, MESSAGES.TIMER_FINISHED));
    await this.sendMessage(chatId, MESSAGES.TIMER_STARTED(formatTimerDuration(durationText)));
  }

  /** Inputs: chat ID, mentioned user, and duration. Bans a user from commands. Output: confirmation or validation response. */
  async handleBan(chatId, args, quotedMessage, sender, command, message) {
    if (!this.adminStore.isAdmin(chatId, sender?.mentionId)) return this.sendMessage(chatId, MESSAGES.ADMIN_ONLY);
    const userId = message.mentionedIds?.[0];
    const durationText = args.at(-1);
    const isIndefinite = durationText?.toLowerCase() === INFINITE_TOKEN;
    const duration = parseDuration(durationText);
    if (!userId || args.length !== 2 || (!isIndefinite && !duration)) return this.sendMessage(chatId, MESSAGES.BAN_USAGE);
    if (isIndefinite) {
      this.adminStore.banIndefinitely(chatId, userId);
      return this.sendMessage(chatId, MESSAGES.USER_BANNED_INDEFINITELY);
    }
    this.adminStore.ban(chatId, userId, Date.now() + duration);
    await this.sendMessage(chatId, MESSAGES.USER_BANNED(formatDuration(durationText)));
  }
  /** Inputs: chat ID. Lists active group bans and administrators. Output: the sent-message promise. */
  async handleConfig(chatId) {
    const bans = this.adminStore.getBans(chatId).map((ban) => ({
      ...ban,
      remaining: ban.isIndefinite ? "indefinidamente" : formatRemainingDuration(ban.until - Date.now()),
    }));
    const admins = this.adminStore.getAdmins(chatId);
    const mentions = [...new Set([...bans.map(({ userId }) => userId), ...admins])];
    await this.sendMessage(chatId, MESSAGES.CONFIG_LIST(bans, admins), mentions.length ? { mentions } : undefined);
  }
  /** Inputs: chat ID and mentioned user. Clears an active ban. Output: confirmation or validation response. */
  async handleUnban(chatId, args, quotedMessage, sender, command, message) {
    if (!this.adminStore.isAdmin(chatId, sender?.mentionId)) return this.sendMessage(chatId, MESSAGES.ADMIN_ONLY);
    const userId = message.mentionedIds?.[0];
    if (!userId) return this.sendMessage(chatId, MESSAGES.UNBAN_USAGE);
    await this.sendMessage(chatId, this.adminStore.unban(chatId, userId) ? MESSAGES.USER_UNBANNED : MESSAGES.USER_NOT_BANNED);
  }
  /** Inputs: chat ID and mentioned user. Grants group-admin access. Output: confirmation or validation response. */
  async handleAdmin(chatId, args, quotedMessage, sender, command, message) {
    if (!this.adminStore.isAdmin(chatId, sender?.mentionId)) return this.sendMessage(chatId, MESSAGES.ADMIN_ONLY);
    const userId = message.mentionedIds?.[0];
    if (!userId) return this.sendMessage(chatId, MESSAGES.ADMIN_USAGE);
    this.adminStore.addAdmin(chatId, userId);
    await this.sendMessage(chatId, MESSAGES.ADMIN_ADDED);
  }
  /** Inputs: chat ID and mentioned user. Revokes group-admin access. Output: confirmation or validation response. */
  async handleNoAdmin(chatId, args, quotedMessage, sender, command, message) {
    if (!this.adminStore.isAdmin(chatId, sender?.mentionId)) return this.sendMessage(chatId, MESSAGES.ADMIN_ONLY);
    const userId = message.mentionedIds?.[0];
    if (!userId) return this.sendMessage(chatId, MESSAGES.NO_ADMIN_USAGE);
    const wasRemoved = this.adminStore.removeAdmin(chatId, userId);
    await this.sendMessage(chatId, wasRemoved ? MESSAGES.ADMIN_REMOVED : MESSAGES.GLOBAL_ADMIN_PROTECTED);
  }
  /** Inputs: chat ID and duration. Pauses non-admin bot responses in the group. Output: confirmation or validation response. */
  async handlePause(chatId, args, quotedMessage, sender) {
    if (!this.adminStore.isAdmin(chatId, sender?.mentionId)) return this.sendMessage(chatId, MESSAGES.ADMIN_ONLY);
    const durationText = args[0];
    const isIndefinite = durationText?.toLowerCase() === INFINITE_TOKEN;
    const duration = parseDuration(durationText);
    if (args.length !== 1 || (!isIndefinite && !duration)) return this.sendMessage(chatId, MESSAGES.PAUSE_USAGE);
    if (isIndefinite) {
      this.adminStore.pauseIndefinitely(chatId);
      return this.sendMessage(chatId, MESSAGES.BOT_PAUSED_INDEFINITELY);
    }
    this.adminStore.pause(chatId, Date.now() + duration);
    await this.sendMessage(chatId, MESSAGES.BOT_PAUSED(formatDuration(args[0])));
  }
  /** Inputs: chat ID and sender. Clears the group pause. Output: confirmation or permission response. */
  async handleUnpause(chatId, args, quotedMessage, sender) {
    if (!this.adminStore.isAdmin(chatId, sender?.mentionId)) return this.sendMessage(chatId, MESSAGES.ADMIN_ONLY);
    await this.sendMessage(chatId, this.adminStore.unpause(chatId) ? MESSAGES.BOT_UNPAUSED : MESSAGES.BOT_NOT_PAUSED);
  }

  /** Inputs: chat ID. Finds the active or next recurring class. Output: the sent-message promise. */
  async handleCurrentClass(chatId) {
    const now = getMexicoCityTime(),
      today = this.classStore.getByDay(chatId, now.day);
    const active = today.find((cls) => now.minutes >= timeToMinutes(cls.startTime) && now.minutes < timeToMinutes(cls.endTime));
    if (active) return this.sendMessage(chatId, MESSAGES.CURRENT_CLASS_ACTIVE(active));
    const nextToday = today.find((cls) => timeToMinutes(cls.startTime) > now.minutes);
    if (nextToday) return this.sendMessage(chatId, MESSAGES.CURRENT_CLASS_NEXT(nextToday, getDays()[DAYS_ORDER.indexOf(nextToday.day)]));
    const classes = this.classStore.getAllSorted(chatId);
    if (!classes.length) return this.sendMessage(chatId, MESSAGES.NO_CLASSES);
    for (let offset = 1; offset <= 7; offset++) {
      const next = classes.find((cls) => cls.day === DAYS_ORDER[(DAYS_ORDER.indexOf(now.day) + offset) % 7]);
      if (next) return this.sendMessage(chatId, MESSAGES.CURRENT_CLASS_NEXT(next, getDays()[DAYS_ORDER.indexOf(next.day)]));
    }
  }

  /** Inputs: chat ID. Lists today's scheduled classes. Output: the sent-message promise. */
  async handleClassesToday(chatId) {
    const result = classService.listClassesToday(chatId, getMexicoCityTime().day, this.classStore);
    await this.sendMessage(chatId, presentClassResult(result).message);
  }

  /** Inputs: chat ID. Lists all classes grouped by weekday. Output: the sent-message promise. */
  async handleAllClasses(chatId) {
    const result = classService.listClasses(chatId, this.classStore);
    await this.sendMessage(chatId, presentClassResult(result).message);
  }

  /** Inputs: chat ID and class fields. Validates and stores a class. Output: confirmation or validation response. */
  async handleAddClass(chatId, args) {
    const parts = args
      .join(" ")
      .split(",")
      .map((item) => item.trim());
    if (parts.length !== 4 || parts.some((item) => !item)) return this.sendMessage(chatId, MESSAGES.ADD_CLASS_USAGE);
    const [name, day, range, classroom] = parts;
    const result = classService.addClass({ chatId, name, day, timeRange: range, classroom }, this.classStore, this.classScheduler);
    await this.sendMessage(chatId, presentClassResult(result).message);
  }

  /** Inputs: chat ID and class update fields. Validates and updates a class. Output: confirmation or validation response. */
  async handleEditClass(chatId, args) {
    const input = args.join(" "),
      comma = input.indexOf(",");
    if (comma === -1) return this.sendMessage(chatId, MESSAGES.EDIT_CLASS_USAGE);
    const updates = this.parseClassUpdates(input.slice(comma + 1).trim(), chatId);
    if (!updates) return;
    const result = classService.updateClass({ chatId, reference: input.slice(0, comma).trim(), updates }, this.classStore, this.classScheduler);
    await this.sendMessage(chatId, presentClassResult(result).message);
  }

  /** Inputs: chat ID and class identifier. Removes a class. Output: confirmation or validation response. */
  async handleDeleteClass(chatId, args) {
    const result = classService.deleteClass({ chatId, reference: args.join(" ").trim() }, this.classStore, this.classScheduler);
    await this.sendMessage(chatId, presentClassResult(result).message);
  }

  /** Inputs: chat ID. Toggles class reminders. Output: the sent-message promise. */
  async handleBell(chatId) {
    const result = classService.toggleBell({ chatId }, this.classStore, this.classScheduler);
    await this.sendMessage(chatId, presentClassResult(result).message);
  }

  /** Inputs: comma-separated field assignments and chat ID. Validates update fields. Output: an update object or undefined after sending an error. */
  async parseClassUpdates(text, chatId) {
    const items = text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const updates = {};
    if (!items.length) {
      await this.sendMessage(chatId, MESSAGES.EDIT_CLASS_USAGE);
      return undefined;
    }
    for (const item of items) {
      const index = item.indexOf("="),
        field = item.slice(0, index).trim().toLowerCase(),
        value = item.slice(index + 1).trim();
      if (index === -1 || !value) {
        await this.sendMessage(chatId, MESSAGES.EDIT_CLASS_USAGE);
        return undefined;
      }
      if (field === "nombre") updates.name = value;
      else if (field === "día" || field === "dia") {
        if (!DAYS_ORDER.includes(value.toLowerCase())) {
          await this.sendMessage(chatId, MESSAGES.INVALID_DAY);
          return undefined;
        }
        updates.day = value;
      } else if (field === "horario") {
        const time = parseTimeRange(value);
        if (!time) {
          await this.sendMessage(chatId, MESSAGES.INVALID_TIME);
          return undefined;
        }
        Object.assign(updates, time);
      } else if (field === "salón" || field === "salon") updates.classroom = value;
      else {
        await this.sendMessage(chatId, MESSAGES.EDIT_UNKNOWN_FIELD(field));
        return undefined;
      }
    }
    return updates;
  }
}

function splitWeatherArguments(args) {
  for (const dateArgumentCount of [2, 1]) {
    if (args.length < dateArgumentCount) continue;
    const date = args.slice(0, dateArgumentCount).join(" ");
    if (resolveMexicoCityDate(date)) return { date, location: args.slice(dateArgumentCount).join(" ") || undefined };
  }
  return { date: undefined, location: args.join(" ") || undefined };
}

function parsePendingDateArguments(args) {
  if (!args[0]?.startsWith("@")) return { date: undefined, argumentCount: 0 };
  for (const argumentCount of [2, 1]) {
    if (args.length < argumentCount) continue;
    const date = parsePendingDate(args.slice(0, argumentCount).join(" "));
    if (date) return { date, argumentCount };
  }
  return { date: undefined, argumentCount: 0 };
}

function emptyGroupReport() {
  const counters = {
    messages: 0,
    nightMessages: 0,
    repliesSent: 0,
    mentionsSent: 0,
    mentionsReceived: 0,
    muninMentions: 0,
    stickers: 0,
    images: 0,
    voiceNotes: 0,
    words: 0,
    feathers: 0,
    commandsUsed: 0,
    remindersCreated: 0,
    messagesSaved: 0,
    pollsCreated: 0,
  };
  return { memberCount: 0, members: [], daily: counters, weekly: counters, currentPendings: 0 };
}
module.exports = CommandHandler;
