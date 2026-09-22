const NotesStore = require("./notesStore");
const ReminderStore = require("./reminderStore");
const ClassStore = require("./classStore");
const { DAYS_ORDER, capitalize } = require("./classStore");
const { COIN_SIDES, COMMANDS, EIGHT_BALL_RESPONSES, MESSAGES } = require("./commandConstants");
const { formatDuration, formatReminder, formatTimerDuration, getMexicoCityTime, parseDuration, parseTimeRange, parseTimerDuration, timeToMinutes } = require("./timeUtils");

class CommandHandler {
  /** Inputs: injected messaging, storage, and scheduler dependencies. Initializes the handler. Output: a configured instance. */
  constructor(
    sendMessage,
    notesStore = new NotesStore(),
    reminderStore = new ReminderStore(),
    reminderScheduler,
    sendPoll,
    classStore = new ClassStore(),
    classScheduler,
    scheduleTimer,
  ) {
    Object.assign(this, { sendMessage, notesStore, reminderStore, reminderScheduler, sendPoll, classStore, classScheduler, scheduleTimer });
  }

  /** Inputs: WhatsApp message, chat ID, optional quote and sender. Dispatches a command. Output: a resolved command response. */
  async handleCommand(message, chatId, quotedMessage, sender) {
    const [command, ...args] = message.body.trim().split(/\s+/);
    const handler = this.getHandlers()[command.toLowerCase()] || this.handleUnknown;
    await handler.call(this, chatId, args, quotedMessage, sender, command);
  }

  /** Inputs: none. Builds command-to-method routing. Output: an object of command handlers. */
  getHandlers() {
    return {
      [COMMANDS.MUNIN]: this.handleMunin,
      [COMMANDS.PING]: this.handlePing,
      [COMMANDS.ECHO]: this.handleEcho,
      [COMMANDS.ADD_NOTE]: this.handleAddNote,
      [COMMANDS.LIST_NOTES]: this.handleListNotes,
      [COMMANDS.DELETE_NOTE]: this.handleDeleteNote,
      [COMMANDS.ADD_REMINDER]: this.handleAddReminder,
      [COMMANDS.LIST_REMINDERS]: this.handleListReminders,
      [COMMANDS.DELETE_REMINDER]: this.handleDeleteReminder,
      [COMMANDS.COIN]: this.handleCoin,
      [COMMANDS.DICE]: this.handleDice,
      [COMMANDS.EIGHT_BALL]: this.handleEightBall,
      [COMMANDS.RANDOM]: this.handleRandom,
      [COMMANDS.POLL]: this.handlePoll,
      [COMMANDS.MULTIPLE_POLL]: this.handlePoll,
      [COMMANDS.TIMER]: this.handleTimer,
      [COMMANDS.CURRENT_CLASS]: this.handleCurrentClass,
      [COMMANDS.LIST_CLASSES_TODAY]: this.handleClassesToday,
      [COMMANDS.LIST_ALL_CLASSES]: this.handleAllClasses,
      [COMMANDS.ADD_CLASS]: this.handleAddClass,
      [COMMANDS.EDIT_CLASS]: this.handleEditClass,
      [COMMANDS.DELETE_CLASS]: this.handleDeleteClass,
      [COMMANDS.BELL]: this.handleBell,
      [COMMANDS.HELP]: this.handleHelp,
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
  /** Inputs: chat ID. Sends command help. Output: the sent-message promise. */
  async handleHelp(chatId) {
    await this.sendMessage(chatId, MESSAGES.HELP);
  }
  /** Inputs: chat ID. Sends unknown-command guidance. Output: the sent-message promise. */
  async handleUnknown(chatId) {
    await this.sendMessage(chatId, MESSAGES.UNKNOWN_COMMAND);
  }

  /** Inputs: chat ID, arguments, optional quote. Stores a note. Output: a confirmation or usage response. */
  async handleAddNote(chatId, args, quotedMessage) {
    const note = args.join(" ").trim() || quotedMessage?.body?.trim();
    if (!note) return this.sendMessage(chatId, MESSAGES.ADD_NOTE_USAGE);
    this.notesStore.add(chatId, note);
    await this.sendMessage(chatId, MESSAGES.NOTE_ADDED(note));
  }

  /** Inputs: chat ID. Lists notes for that chat. Output: the sent-message promise. */
  async handleListNotes(chatId) {
    const notes = this.notesStore.getAll(chatId);
    await this.sendMessage(chatId, notes.length ? MESSAGES.NOTES_LIST(notes) : MESSAGES.NO_NOTES);
  }

  /** Inputs: chat ID and note index. Deletes a note. Output: confirmation or validation response. */
  async handleDeleteNote(chatId, args) {
    const index = Number(args[0]);
    if (args.length !== 1 || !Number.isInteger(index) || index < 1) return this.sendMessage(chatId, MESSAGES.DELETE_NOTE_USAGE);
    await this.sendMessage(chatId, this.notesStore.remove(chatId, index - 1) ? MESSAGES.NOTE_DELETED(index) : MESSAGES.DELETE_NOTE_NOT_FOUND);
  }

  /** Inputs: chat ID, duration/content arguments, optional quote and sender. Stores and schedules a reminder. Output: confirmation or usage response. */
  async handleAddReminder(chatId, args, quotedMessage, sender) {
    const durationText = args[0],
      duration = parseDuration(durationText),
      content = args.slice(1).join(" ").trim() || quotedMessage?.body?.trim();
    if (!content || !duration) return this.sendMessage(chatId, MESSAGES.ADD_REMINDER_USAGE);
    const reminder = this.reminderStore.add(chatId, content, Date.now() + duration);
    this.reminderScheduler?.schedule({ chatId, ...reminder });
    await this.sendMessage(
      chatId,
      MESSAGES.REMINDER_ADDED(sender?.tag, formatDuration(durationText), content),
      sender?.mentionId ? { mentions: [sender.mentionId] } : undefined,
    );
  }

  /** Inputs: chat ID. Lists reminders for that chat. Output: the sent-message promise. */
  async handleListReminders(chatId) {
    const reminders = this.reminderStore.getAll(chatId);
    await this.sendMessage(chatId, reminders.length ? MESSAGES.REMINDERS_LIST(reminders.map(formatReminder)) : MESSAGES.NO_REMINDERS);
  }
  /** Inputs: chat ID and reminder index. Cancels and deletes a reminder. Output: confirmation or validation response. */
  async handleDeleteReminder(chatId, args) {
    const index = Number(args[0]);
    if (args.length !== 1 || !Number.isInteger(index) || index < 1) return this.sendMessage(chatId, MESSAGES.DELETE_REMINDER_USAGE);
    const reminder = this.reminderStore.remove(chatId, index - 1);
    if (reminder) this.reminderScheduler?.cancel(reminder.id);
    await this.sendMessage(chatId, reminder ? MESSAGES.REMINDER_DELETED(index) : MESSAGES.DELETE_REMINDER_NOT_FOUND);
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
  async handlePoll(chatId, args, command) {
    const [title, ...options] = args
      .join(" ")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (options.length < 2) return this.sendMessage(chatId, MESSAGES.POLL_USAGE);
    await this.sendPoll(chatId, title, options, command.toLowerCase() === COMMANDS.MULTIPLE_POLL);
  }

  /** Inputs: chat ID and a s/m/h duration. Schedules a one-shot timer. Output: confirmation or usage response. */
  async handleTimer(chatId, args) {
    const durationText = args[0];
    const duration = parseTimerDuration(durationText);
    if (args.length !== 1 || !duration) return this.sendMessage(chatId, MESSAGES.TIMER_USAGE);
    this.scheduleTimer?.(duration, () => this.sendMessage(chatId, MESSAGES.TIMER_FINISHED));
    await this.sendMessage(chatId, MESSAGES.TIMER_STARTED(formatTimerDuration(durationText)));
  }

  /** Inputs: chat ID. Finds the active or next recurring class. Output: the sent-message promise. */
  async handleCurrentClass(chatId) {
    const now = getMexicoCityTime(),
      today = this.classStore.getByDay(chatId, now.day);
    const active = today.find((cls) => now.minutes >= timeToMinutes(cls.startTime) && now.minutes < timeToMinutes(cls.endTime));
    if (active) return this.sendMessage(chatId, MESSAGES.CURRENT_CLASS_ACTIVE(active));
    const nextToday = today.find((cls) => timeToMinutes(cls.startTime) > now.minutes);
    if (nextToday) return this.sendMessage(chatId, MESSAGES.CURRENT_CLASS_NEXT(nextToday, capitalize(nextToday.day)));
    const classes = this.classStore.getAllSorted(chatId);
    if (!classes.length) return this.sendMessage(chatId, MESSAGES.NO_CLASSES);
    for (let offset = 1; offset <= 7; offset++) {
      const next = classes.find((cls) => cls.day === DAYS_ORDER[(DAYS_ORDER.indexOf(now.day) + offset) % 7]);
      if (next) return this.sendMessage(chatId, MESSAGES.CURRENT_CLASS_NEXT(next, capitalize(next.day)));
    }
  }

  /** Inputs: chat ID. Lists today's scheduled classes. Output: the sent-message promise. */
  async handleClassesToday(chatId) {
    const day = getMexicoCityTime().day,
      classes = this.classStore.getByDay(chatId, day);
    if (!classes.length) return this.sendMessage(chatId, MESSAGES.NO_CLASSES_TODAY);
    await this.sendMessage(chatId, MESSAGES.CLASSES_TODAY(capitalize(day), classes.map(formatClassLine)));
  }

  /** Inputs: chat ID. Lists all classes grouped by weekday. Output: the sent-message promise. */
  async handleAllClasses(chatId) {
    const classes = this.classStore.getAllSorted(chatId);
    if (!classes.length) return this.sendMessage(chatId, MESSAGES.NO_CLASSES);
    const groups = DAYS_ORDER.map((day) => [day, classes.filter((cls) => cls.day === day)])
      .filter(([, items]) => items.length)
      .map(([day, items]) => `${capitalize(day)}:\n${items.map((cls) => `  ${formatClassLine(cls)}`).join("\n")}`);
    await this.sendMessage(chatId, MESSAGES.ALL_CLASSES(groups));
  }

  /** Inputs: chat ID and class fields. Validates and stores a class. Output: confirmation or validation response. */
  async handleAddClass(chatId, args) {
    const parts = args
      .join(" ")
      .split(",")
      .map((item) => item.trim());
    if (parts.length !== 4 || parts.some((item) => !item)) return this.sendMessage(chatId, MESSAGES.ADD_CLASS_USAGE);
    const [name, day, range, classroom] = parts,
      time = parseTimeRange(range);
    if (!DAYS_ORDER.includes(day.toLowerCase())) return this.sendMessage(chatId, MESSAGES.INVALID_DAY);
    if (!time) return this.sendMessage(chatId, MESSAGES.INVALID_TIME);
    const cls = this.classStore.add(chatId, { name, day, startTime: time.startTime, endTime: time.endTime, classroom });
    this.classScheduler?.rescheduleForChat(chatId);
    await this.sendMessage(chatId, MESSAGES.CLASS_ADDED(cls, capitalize(cls.day)));
  }

  /** Inputs: chat ID and class update fields. Validates and updates a class. Output: confirmation or validation response. */
  async handleEditClass(chatId, args) {
    const input = args.join(" "),
      comma = input.indexOf(",");
    if (comma === -1) return this.sendMessage(chatId, MESSAGES.EDIT_CLASS_USAGE);
    const resolved = this.classStore.resolve(chatId, input.slice(0, comma).trim());
    if (resolved.ambiguous) return this.sendMessage(chatId, MESSAGES.CLASS_AMBIGUOUS(formatClassMatches(resolved.matches)));
    if (!resolved.class) return this.sendMessage(chatId, MESSAGES.CLASS_NOT_FOUND);
    const updates = this.parseClassUpdates(input.slice(comma + 1).trim(), chatId);
    if (!updates) return;
    const cls = this.classStore.update(chatId, resolved.class.id, updates);
    this.classScheduler?.rescheduleForChat(chatId);
    await this.sendMessage(chatId, MESSAGES.CLASS_EDITED(cls, capitalize(cls.day)));
  }

  /** Inputs: chat ID and class identifier. Removes a class. Output: confirmation or validation response. */
  async handleDeleteClass(chatId, args) {
    const resolved = this.classStore.resolve(chatId, args.join(" ").trim());
    if (resolved.ambiguous) return this.sendMessage(chatId, MESSAGES.CLASS_AMBIGUOUS(formatClassMatches(resolved.matches)));
    if (!resolved.class) return this.sendMessage(chatId, MESSAGES.CLASS_NOT_FOUND);
    const cls = this.classStore.remove(chatId, resolved.class.id);
    this.classScheduler?.rescheduleForChat(chatId);
    await this.sendMessage(chatId, MESSAGES.CLASS_DELETED(cls.name));
  }

  /** Inputs: chat ID. Toggles class reminders. Output: the sent-message promise. */
  async handleBell(chatId) {
    const enabled = this.classStore.toggleBell(chatId);
    this.classScheduler?.rescheduleForChat(chatId);
    await this.sendMessage(chatId, enabled ? MESSAGES.BELL_ON : MESSAGES.BELL_OFF);
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

/** Inputs: a class record. Formats one class list line. Output: formatted text. */
function formatClassLine(cls) {
  return `${cls.globalIndex}. ${cls.name} — ${cls.startTime} - ${cls.endTime} — ${cls.classroom}`;
}

/** Inputs: matching class records. Formats ambiguity choices. Output: an array of formatted lines. */
function formatClassMatches(classes) {
  return classes.map((cls) => `  ${formatClassLine(cls)}`);
}
module.exports = CommandHandler;
