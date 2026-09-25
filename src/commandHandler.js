const PendingStore = require("./pendingStore");
const ReminderStore = require("./reminderStore");
const ClassStore = require("./classStore");
const AdminStore = require("./adminStore");
const CustomCommandStore = require("./customCommandStore");
const SavedMessageStore = require("./savedMessageStore");
const { formatAllClasses, formatClassesToday, formatPendings, formatReminders, formatSavedMessages } = require("./listResponseFormatter");
const { getPendingContent, parsePendingDate, parsePendingTime } = require("./pendingUtils");
const { DAYS_ORDER, capitalize } = require("./classStore");
const { COIN_SIDES, COMMANDS, EIGHT_BALL_RESPONSES, INFINITE_TOKEN, MESSAGES } = require("./commandConstants");
const {
  formatDuration,
  formatRemainingDuration,
  formatTimerDuration,
  getMexicoCityTime,
  parseDuration,
  parseTimeRange,
  parseTimerDuration,
  timeToMinutes,
} = require("./timeUtils");

class CommandHandler {
  /** Inputs: injected messaging, storage, and scheduler dependencies. Initializes the handler. Output: a configured instance. */
  constructor(
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
  ) {
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
    const maxAmount = this.summarizer?.maxAmount;
    if (!Number.isInteger(maxAmount) || typeof this.generateSummary !== "function") {
      return this.sendMessage(chatId, MESSAGES.SUMMARY_UNAVAILABLE);
    }

    const amount = Number(args[0]);
    if (args.length !== 1 || !Number.isInteger(amount) || amount < 1 || amount > maxAmount) {
      return this.sendMessage(chatId, MESSAGES.SUMMARY_USAGE(maxAmount));
    }

    const conversation = this.summarizer.formatRecentMessages(chatId, amount, message);
    if (!conversation) return this.sendMessage(chatId, MESSAGES.SUMMARY_NO_MESSAGES);

    const summary = await this.generateSummary(conversation);
    await this.sendMessage(chatId, summary || MESSAGES.SUMMARY_UNAVAILABLE);
  }
  /** Inputs: chat ID, command name, and reply arguments. Creates or updates a group-specific custom command. Output: confirmation or usage response. */
  async handleCreateCustomCommand(chatId, args) {
    if (args[0] === "-") return this.handleDeleteCustomCommand(chatId, args.slice(1));

    const command = args[0]?.toLowerCase();
    const reply = args.slice(1).join(" ").trim();
    if (!command || !/^![a-z0-9_-]+$/i.test(command) || !reply) {
      return this.sendMessage(chatId, MESSAGES.CUSTOM_COMMAND_USAGE);
    }
    if (Object.hasOwn(this.getHandlers(), command)) return this.sendMessage(chatId, MESSAGES.CUSTOM_COMMAND_BUILTIN_CONFLICT(command));

    const alreadyExists = this.customCommandStore.set(chatId, command, reply);
    await this.sendMessage(chatId, alreadyExists ? MESSAGES.CUSTOM_COMMAND_UPDATED(command) : MESSAGES.CUSTOM_COMMAND_CREATED(command));
  }
  /** Inputs: chat ID. Lists custom commands in the current group. Output: the sent-message promise. */
  async handleListCustomCommands(chatId) {
    const commands = this.customCommandStore.getAll(chatId);
    await this.sendMessage(chatId, commands.length ? MESSAGES.CUSTOM_COMMANDS_LIST(commands) : MESSAGES.NO_CUSTOM_COMMANDS);
  }
  /** Inputs: chat ID and custom-command index. Deletes a custom command. Output: confirmation, usage, or not-found response. */
  async handleDeleteCustomCommand(chatId, args) {
    const index = Number(args[0]);
    if (args.length !== 1 || !Number.isInteger(index) || index < 1) return this.sendMessage(chatId, MESSAGES.DELETE_CUSTOM_COMMAND_USAGE);
    const deletedCommand = this.customCommandStore.removeAt(chatId, index - 1);
    await this.sendMessage(
      chatId,
      deletedCommand ? MESSAGES.CUSTOM_COMMAND_DELETED(deletedCommand.command) : MESSAGES.CUSTOM_COMMAND_INDEX_NOT_FOUND,
    );
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

    if (!title || !message.hasQuotedMsg || !message._data?.quotedStanzaID || !message._data?.quotedParticipant) {
      return this.sendMessage(chatId, MESSAGES.SAVE_MESSAGE_USAGE);
    }

    const quotedParticipant = message._data.quotedParticipant?._serialized ?? message._data.quotedParticipant;

    const fromMe = quotedParticipant === botLid;

    const quotedMessageId = `${fromMe}_${chatId}_${message._data.quotedStanzaID}_${quotedParticipant}`;

    const alreadyExists = this.savedMessageStore.set(chatId, title, quotedMessageId);

    await this.sendMessage(chatId, alreadyExists ? MESSAGES.SAVED_MESSAGE_UPDATED(title) : MESSAGES.SAVED_MESSAGE_CREATED(title));
  }
  /** Inputs: chat ID and title arguments. Sends a bot message quoting the saved command message. Output: confirmation or not-found response. */
  async handleViewSavedMessage(chatId, args) {
    const title = args.join(" ").trim();

    if (!title) {
      return this.sendMessage(chatId, MESSAGES.VIEW_SAVED_MESSAGE_USAGE);
    }

    const savedMessage = this.savedMessageStore.get(chatId, title);

    if (!savedMessage) {
      return this.sendMessage(chatId, MESSAGES.SAVED_MESSAGE_NOT_FOUND(title));
    }

    await this.sendMessage(chatId, MESSAGES.SAVED_MESSAGE_REPLY(savedMessage.title), {
      quotedMessageId: savedMessage.messageId,
    });
  }
  /** Inputs: chat ID. Lists saved message titles for the current group. Output: the sent-message promise. */
  async handleListSavedMessages(chatId) {
    const savedMessages = this.savedMessageStore.getAll(chatId);
    await this.sendMessage(chatId, formatSavedMessages(savedMessages));
  }
  /** Inputs: chat ID and saved-message index. Deletes a saved message from the current group. Output: confirmation, usage, or not-found response. */
  async handleDeleteSavedMessage(chatId, args) {
    const index = Number(args[0]);
    if (args.length !== 1 || !Number.isInteger(index) || index < 1) return this.sendMessage(chatId, MESSAGES.DELETE_SAVED_MESSAGE_USAGE);
    const savedMessage = this.savedMessageStore.removeAt(chatId, index - 1);
    await this.sendMessage(chatId, savedMessage ? MESSAGES.SAVED_MESSAGE_DELETED(savedMessage.title) : MESSAGES.SAVED_MESSAGE_INDEX_NOT_FOUND);
  }
  /** Inputs: chat ID and an optional help-page number. Sends the requested help page. Output: the sent-message promise. */
  async handleHelp(chatId, args) {
    const page = args.length === 0 ? 1 : Number(args[0]);
    if (args.length > 1 || !Number.isInteger(page) || !MESSAGES.HELP_PAGE(page)) return this.sendMessage(chatId, MESSAGES.HELP_PAGE_USAGE);
    await this.sendMessage(chatId, MESSAGES.HELP_PAGE(page));
  }
  /** Inputs: chat ID and unknown command name. Sends command-specific guidance. Output: the sent-message promise. */
  async handleUnknown(chatId, args, quotedMessage, sender, command) {
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
    const date = parsePendingDate(args[0]);
    if (args[0]?.startsWith("@") && !date) return this.sendMessage(chatId, MESSAGES.PENDING_USAGE);

    const timeIndex = date ? 1 : 0;
    const time = parsePendingTime(args[timeIndex]);
    if (/^\d{1,2}:\d{2}$/.test(args[timeIndex] || "") && !time) return this.sendMessage(chatId, MESSAGES.PENDING_USAGE);

    const pending =
      args
        .slice((date ? 1 : 0) + (time ? 1 : 0))
        .join(" ")
        .trim() || quotedMessage?.body?.trim();
    if (!pending) return this.sendMessage(chatId, MESSAGES.PENDING_USAGE);
    this.pendingStore.add(chatId, pending, date, time);
    await this.sendMessage(
      chatId,
      MESSAGES.MUTATION_WITH_LIST(MESSAGES.PENDING_ADDED(pending, date, time), formatPendings(this.pendingStore.getAll(chatId))),
    );
  }

  /** Inputs: chat ID. Lists pending items for that chat. Output: the sent-message promise. */
  async handleListPending(chatId) {
    const pendings = this.pendingStore.getAll(chatId);
    await this.sendMessage(chatId, formatPendings(pendings));
  }

  /** Inputs: chat ID and pending-item index. Deletes a pending item. Output: confirmation or validation response. */
  async handleDeletePending(chatId, args) {
    const index = Number(args[0]);
    if (args.length !== 1 || !Number.isInteger(index) || index < 1) return this.sendMessage(chatId, MESSAGES.PENDING_USAGE);
    const pending = this.pendingStore.remove(chatId, index - 1);
    if (pending === undefined) return this.sendMessage(chatId, MESSAGES.DELETE_PENDING_NOT_FOUND);
    await this.sendMessage(
      chatId,
      MESSAGES.MUTATION_WITH_LIST(MESSAGES.PENDING_DELETED(index, getPendingContent(pending)), formatPendings(this.pendingStore.getAll(chatId))),
    );
  }

  /** Inputs: chat ID, arguments, optional quote, and sender. Adds, lists, or deletes reminders based on the !r syntax. Output: the sent-message promise. */
  async handleReminder(chatId, args, quotedMessage, sender) {
    if (args[0] === "-") return this.handleDeleteReminder(chatId, args.slice(1));
    if (args.length === 0) return this.handleListReminders(chatId);

    const durationText = args[0];
    const recurrenceMatch = args[1]?.match(/^x(\d+)$/i);
    const repeatsForever = args[1]?.toLowerCase() === INFINITE_TOKEN;
    return recurrenceMatch || repeatsForever
      ? this.handleAddRecurringReminder(chatId, durationText, recurrenceMatch?.[1], args.slice(2), quotedMessage)
      : this.handleAddReminder(chatId, durationText, args.slice(1), quotedMessage, sender);
  }

  /** Inputs: chat ID, duration text, content arguments, optional quote and sender. Stores and schedules a one-time reminder. Output: confirmation or usage response. */
  async handleAddReminder(chatId, durationText, contentArgs, quotedMessage, sender) {
    const duration = parseDuration(durationText);
    const content = contentArgs.join(" ").trim() || quotedMessage?.body?.trim();
    if (!content || !duration) return this.sendMessage(chatId, MESSAGES.REMINDER_USAGE);
    const reminder = this.reminderStore.add(chatId, content, Date.now() + duration);
    this.reminderScheduler?.schedule({ chatId, ...reminder });
    await this.sendMessage(
      chatId,
      MESSAGES.MUTATION_WITH_LIST(
        MESSAGES.REMINDER_ADDED(sender?.tag, formatDuration(durationText), content),
        formatReminders(this.reminderStore.getAll(chatId)),
      ),
      sender?.mentionId ? { mentions: [sender.mentionId] } : undefined,
    );
  }
  /** Inputs: chat ID, interval text, optional repetition count, content arguments, and optional quote. Creates a recurring reminder. Output: confirmation or usage response. */
  async handleAddRecurringReminder(chatId, intervalText, repetitionCount, contentArgs, quotedMessage) {
    const interval = parseDuration(intervalText);
    const content = contentArgs.join(" ").trim() || quotedMessage?.body?.trim();
    const remaining = repetitionCount ? Number(repetitionCount) : null;
    if (!content || !interval || interval < 600000 || (remaining !== null && (!Number.isInteger(remaining) || remaining < 1)))
      return this.sendMessage(chatId, MESSAGES.REMINDER_USAGE);
    const reminder = this.reminderStore.addRecurring(chatId, content, Date.now() + interval, interval, remaining);
    this.reminderScheduler?.schedule({ chatId, ...reminder });
    const repetitions = remaining === null ? "infinitas veces" : `${remaining} veces`;
    await this.sendMessage(
      chatId,
      MESSAGES.MUTATION_WITH_LIST(
        MESSAGES.RECURRING_REMINDER_ADDED(formatDuration(intervalText), repetitions, content),
        formatReminders(this.reminderStore.getAll(chatId)),
      ),
    );
  }

  /** Inputs: chat ID. Lists reminders for that chat. Output: the sent-message promise. */
  async handleListReminders(chatId) {
    const reminders = this.reminderStore.getAll(chatId);
    await this.sendMessage(chatId, formatReminders(reminders));
  }
  /** Inputs: chat ID and reminder index. Cancels and deletes a reminder. Output: confirmation or validation response. */
  async handleDeleteReminder(chatId, args) {
    const index = Number(args[0]);
    if (args.length !== 1 || !Number.isInteger(index) || index < 1) return this.sendMessage(chatId, MESSAGES.REMINDER_USAGE);
    const reminder = this.reminderStore.remove(chatId, index - 1);
    if (reminder) this.reminderScheduler?.cancel(reminder.id);
    if (!reminder) return this.sendMessage(chatId, MESSAGES.DELETE_REMINDER_NOT_FOUND);
    await this.sendMessage(
      chatId,
      MESSAGES.MUTATION_WITH_LIST(MESSAGES.REMINDER_DELETED(index, reminder.content), formatReminders(this.reminderStore.getAll(chatId))),
    );
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
    await this.sendMessage(chatId, formatClassesToday(day, classes, undefined, this.classStore.getBell(chatId)));
  }

  /** Inputs: chat ID. Lists all classes grouped by weekday. Output: the sent-message promise. */
  async handleAllClasses(chatId) {
    const classes = this.classStore.getAllSorted(chatId);
    await this.sendMessage(chatId, formatAllClasses(classes, undefined, this.classStore.getBell(chatId)));
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
    await this.sendMessage(
      chatId,
      MESSAGES.MUTATION_WITH_LIST(MESSAGES.CLASS_ADDED(cls, capitalize(cls.day)), formatAllClasses(this.classStore.getAllSorted(chatId), undefined, this.classStore.getBell(chatId))),
    );
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
    await this.sendMessage(
      chatId,
      MESSAGES.MUTATION_WITH_LIST(MESSAGES.CLASS_EDITED(cls, capitalize(cls.day)), formatAllClasses(this.classStore.getAllSorted(chatId), undefined, this.classStore.getBell(chatId))),
    );
  }

  /** Inputs: chat ID and class identifier. Removes a class. Output: confirmation or validation response. */
  async handleDeleteClass(chatId, args) {
    const resolved = this.classStore.resolve(chatId, args.join(" ").trim());
    if (resolved.ambiguous) return this.sendMessage(chatId, MESSAGES.CLASS_AMBIGUOUS(formatClassMatches(resolved.matches)));
    if (!resolved.class) return this.sendMessage(chatId, MESSAGES.CLASS_NOT_FOUND);
    const cls = this.classStore.remove(chatId, resolved.class.id);
    this.classScheduler?.rescheduleForChat(chatId);
    await this.sendMessage(
      chatId,
      MESSAGES.MUTATION_WITH_LIST(MESSAGES.CLASS_DELETED(cls.name), formatAllClasses(this.classStore.getAllSorted(chatId), undefined, this.classStore.getBell(chatId))),
    );
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
