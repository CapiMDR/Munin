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
const summaryService = require("../services/summaryService");
const { presentSummaryResult } = require("../presenters/summaryPresenter");
const classService = require("../services/classService");
const triviaService = require("../services/triviaService");
const weatherService = require("../services/weatherService");
const { resolveMexicoCityDate } = require("../utils/dateUtils");
const { COMMANDS, INFINITE_TOKEN } = require("../config/commandConstants");
const adminService = require("../services/adminService");
const { presentAdminResult } = require("../presenters/adminPresenter");
const basicCommandService = require("../services/basicCommandService");
const { presentBasicCommandResult } = require("../presenters/basicCommandPresenter");
const {
} = require("../utils/timeUtils");

/**
 * Parses formal commands, invokes the appropriate application services, and
 * returns output DTOs for the message handler to deliver.
 */
class CommandHandler {
  /**
   * Creates a command handler with its storage, scheduling, and service dependencies.
   * @param {object} dependencies Application dependencies.
   */
  constructor({
    pendingStore = new PendingStore(),
    reminderStore = new ReminderStore(),
    reminderScheduler,
    classStore = new ClassStore(),
    classScheduler,
    adminStore = new AdminStore(),
    customCommandStore = new CustomCommandStore(),
    savedMessageStore = new SavedMessageStore(),
    getBotLid = () => undefined,
    summarizer,
    generateSummary,
    suggestSimilarCommand,
    userStatsStore,
    weeklyReportStore,
    openMeteoApi,
    openTriviaApi,
    translateTrivia,
    triviaManager,
  } = {}) {
    Object.assign(this, {
      pendingStore,
      reminderStore,
      reminderScheduler,
      classStore,
      classScheduler,
      adminStore,
      customCommandStore,
      savedMessageStore,
      getBotLid,
      summarizer,
      generateSummary,
      suggestSimilarCommand,
      userStatsStore,
      weeklyReportStore,
      openMeteoApi,
      openTriviaApi,
      translateTrivia,
      triviaManager,
    });
    this.outputContext = new AsyncLocalStorage();
  }

  /**
   * Adds a text output DTO to the active command response.
   * @param {string} chatId WhatsApp group chat ID.
   * @param {string} text Text to deliver.
   * @param {object} [options] WhatsApp message options.
   * @returns {object} Text output DTO.
   */
  sendMessage(chatId, text, options) {
    return this.createOutput({ type: "text", chatId, text, options });
  }

  /**
   * Adds an animal-image output DTO to the active command response.
   * @returns {object} Animal-image output DTO.
   */
  sendAnimalImage(chatId, animal, fallbackText) {
    return this.createOutput({ type: "animal_image", chatId, animal, fallbackText });
  }

  /**
   * Records an output in the asynchronous context for the current command.
   * @param {object} output Output DTO.
   * @returns {object} The recorded DTO.
   */
  createOutput(output) {
    this.outputContext.getStore()?.push(output);
    return output;
  }

  /**
   * Adds the output DTOs produced by the basic-command presenter to this command response.
   * @param {string} chatId WhatsApp group chat ID.
   * @param {object} result Basic-command service result.
   * @returns {Promise<object|undefined>} Created output DTO, when applicable.
   */
  async sendBasicResult(chatId, result) {
    const presentation = presentBasicCommandResult(result, { chatId });
    if (presentation.outputs) return presentation.outputs.map((output) => this.createOutput(output));
    if (presentation.output) return this.createOutput(presentation.output);
    return this.sendMessage(chatId, presentation.message);
  }

  /**
   * Handles one formal command and returns its output DTOs.
   * @returns {Promise<object[]|undefined>} Outputs, or undefined when the sender cannot invoke commands.
   */
  async handleCommand(message, chatId, quotedMessage, sender, messageId, commandText = message.body) {
    const [command, ...args] = commandText.trim().split(/\s+/);
    if (this.adminStore.isBanned(chatId, sender?.mentionId)) return;
    if (this.adminStore.isPaused(chatId) && !this.adminStore.isAdmin(chatId, sender?.mentionId)) return;
    const commandKey = command.toLowerCase();
    const handlers = this.getHandlers();
    const handler = handlers[commandKey] || (this.customCommandStore.has(chatId, commandKey) ? this.handleCustomCommand : this.handleUnknown);
    const outputs = [];
    return this.outputContext.run(outputs, async () => {
      await handler.call(this, chatId, args, quotedMessage, sender, command, message, messageId, this.getBotLid());
      return outputs;
    });
  }

  /**
   * Builds the built-in command routing table.
   * @returns {Record<string, Function>} Command handlers indexed by command name.
   */
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
    await this.sendBasicResult(chatId, basicCommandService.getWelcome());
  }
  /** Inputs: chat ID. Sends the ping response. Output: the sent-message promise. */
  async handlePing(chatId) {
    await this.sendBasicResult(chatId, basicCommandService.getPing());
  }
  /** Inputs: chat ID and text arguments. Echoes text. Output: the sent-message promise. */
  async handleEcho(chatId, args) {
    await this.sendBasicResult(chatId, basicCommandService.echo({ args }));
  }
  /** Inputs: chat ID, requested message count, and the command message. Summarizes recent prior group messages with the LLM. Output: the sent-message promise. */
  async handleSummary(chatId, args, quotedMessage, sender, command, message) {
    const amount = Number(args[0]);
    const result = summaryService.prepareSummary(
      { chatId, amount: args.length === 1 ? amount : undefined, excludedMessage: message },
      this.summarizer,
    );
    const presentation = presentSummaryResult(result);
    if (!presentation.ok) return this.sendMessage(chatId, presentation.message);
    const summaryResult = await summaryService.generateSummary(presentation.conversation, this.generateSummary);
    await this.sendMessage(chatId, presentSummaryResult(summaryResult).message);
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
      const result = customCommandService.deleteCustomCommandByName({ chatId, command: commandKey }, this.customCommandStore);
      return this.sendMessage(chatId, presentCustomCommandResult(result).message);
    }
    await this.sendMessage(chatId, this.customCommandStore.get(chatId, commandKey));
  }
  /** Inputs: chat ID, title arguments, quoted message, command message, and serialized message ID. Saves the command message ID under a group-specific title. Output: confirmation or usage response. */
  async handleSaveMessage(chatId, args, quotedMessage, sender, command, message, messageId, botLid) {
    const title = args.join(" ").trim();

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
    const index = args.length === 1 ? Number(args[0]) - 1 : undefined;
    const result = savedMessageService.deleteSavedMessage(chatId, index, this.savedMessageStore);
    const presentation = presentSavedMessageResult(result);
    await this.sendMessage(chatId, presentation.message);
  }
  /** Inputs: chat ID and an optional help-page number. Sends the requested help page. Output: the sent-message promise. */
  async handleHelp(chatId, args) {
    const presentation = presentHelpResult(helpService.getHelp({ page: args.length === 0 ? 1 : args.length === 1 ? Number(args[0]) : undefined }));
    await this.sendMessage(chatId, presentation.message);
  }
  /** Inputs: chat ID, sender, and command message. Shows mentioned-user activity or the sender's when no one is mentioned. Output: the sent-message promise. */
  async handleStats(chatId, args, quotedMessage, sender, command, message) {
    const mentionedContacts = await message.getMentions();
    let targetMentionId = sender?.mentionId;

    if (mentionedContacts.length === 1) {
      const contact = mentionedContacts[0];
      targetMentionId = contact?.id?._serialized ?? contact?.id?.$1;
    }

    const presentation = presentStatsResult(
      statsService.getUserStats({ chatId, mentionId: targetMentionId, mentionedCount: mentionedContacts.length }, this.userStatsStore),
    );
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
    await this.sendBasicResult(chatId, basicCommandService.toggleWeeklyReport({ chatId }, this.weeklyReportStore));
  }
  /** Inputs: chat ID. Fetches and sends a random cat image. Output: the sent-message promise. */
  async handleCat(chatId) {
    await this.sendBasicResult(chatId, basicCommandService.requestAnimalImage({ animal: "cat" }));
  }
  /** Inputs: chat ID. Fetches and sends a random dog image. Output: the sent-message promise. */
  async handleDog(chatId) {
    await this.sendBasicResult(chatId, basicCommandService.requestAnimalImage({ animal: "dog" }));
  }
  /** Inputs: chat ID and optional dd/mm date. Sends the daily forecast for Munin's configured location. Output: the sent-message promise. */
  async handleWeather(chatId, args) {
    const { date, location } = splitWeatherArguments(args);
    const result = await weatherService.getWeather({ date, location }, this.openMeteoApi);
    await this.sendMessage(chatId, presentWeatherResult(result).message);
  }
  /** Inputs: chat ID and a requested trivia-question count. Fetches a batch and sends its first question with shuffled answers. Output: the sent-message promise. */
  async handleTrivia(chatId, args) {
    const amount = args.length === 1 ? Number(args[0]) : undefined;
    const result = await triviaService.startTrivia({ chatId, amount }, this);
    const presentation = presentTriviaResult(result);
    if (!presentation.ok) await this.sendMessage(chatId, presentation.message);
  }
  /** Inputs: chat ID and unknown command name. Asks the LLM for a close, existing command name. Output: the sent-message promise. */
  async handleUnknown(chatId, args, quotedMessage, sender, command) {
    const availableCommands = [...Object.keys(this.getHandlers()), ...this.customCommandStore.getAll(chatId).map(({ command: name }) => name)];
    const result = await basicCommandService.resolveUnknownCommand({ command, availableCommands }, this.suggestSimilarCommand);
    await this.sendBasicResult(chatId, result);
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
    const result = pendingService.createPendingFromCommand({ chatId, args, quotedContent: quotedMessage?.body }, this.pendingStore);
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
    const index = args.length === 1 ? Number(args[0]) - 1 : undefined;
    const result = pendingService.deletePending(chatId, index, this.pendingStore);
    await this.sendMessage(chatId, presentPendingResult(result).message);
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
    await this.sendMessage(chatId, presentReminderResult(result, { duration: intervalText }).message);
  }

  /** Inputs: chat ID. Lists reminders for that chat. Output: the sent-message promise. */
  async handleListReminders(chatId) {
    const result = reminderService.listReminders(chatId, this.reminderStore);
    await this.sendMessage(chatId, presentReminderResult(result).message);
  }
  /** Inputs: chat ID and reminder index. Cancels and deletes a reminder. Output: confirmation or validation response. */
  async handleDeleteReminder(chatId, args) {
    const index = args.length === 1 ? Number(args[0]) - 1 : undefined;
    const result = reminderService.deleteReminder(chatId, index, this.reminderStore, this.reminderScheduler);
    await this.sendMessage(chatId, presentReminderResult(result).message);
  }

  /** Inputs: chat ID. Selects a random coin side. Output: the sent-message promise. */
  async handleCoin(chatId) {
    await this.sendBasicResult(chatId, basicCommandService.flipCoin());
  }
  /** Inputs: chat ID. Rolls a random die result. Output: the sent-message promise. */
  async handleDice(chatId) {
    await this.sendBasicResult(chatId, basicCommandService.rollDice());
  }
  /** Inputs: chat ID. Selects a random eight-ball response. Output: the sent-message promise. */
  async handleEightBall(chatId) {
    await this.sendBasicResult(chatId, basicCommandService.askEightBall());
  }

  /** Inputs: chat ID and comma-separated options. Selects one option. Output: result or usage response. */
  async handleRandom(chatId, args) {
    await this.sendBasicResult(chatId, basicCommandService.chooseRandom({ args }));
  }

  /** Inputs: chat ID, comma-separated title/options, and poll command. Creates a single or multiple-choice poll. Output: sent-poll or usage promise. */
  async handlePoll(chatId, args, quotedMessage, sender, command) {
    const { title, options } = parsePollArguments(args);
    await this.sendBasicResult(
      chatId,
      basicCommandService.createPoll(
        { chatId, title, options, allowMultipleAnswers: command.toLowerCase() === COMMANDS.MULTIPLE_POLL, senderMentionId: sender?.mentionId },
        this.userStatsStore,
      ),
    );
  }

  /** Inputs: chat ID and a s/m/h duration. Schedules a one-shot timer. Output: confirmation or usage response. */
  async handleTimer(chatId, args) {
    const durationText = args.length === 1 ? args[0] : undefined;
    await this.sendBasicResult(chatId, basicCommandService.createTimer({ durationText }));
  }

  /** Inputs: chat ID, mentioned user, and duration. Bans a user from commands. Output: confirmation or validation response. */
  async handleBan(chatId, args, quotedMessage, sender, command, message) {
    const result = adminService.banUser(
      { chatId, senderId: sender?.mentionId, userId: message.mentionedIds?.[0], argumentCount: args.length, durationText: args.at(-1) },
      this.adminStore,
    );
    const presentation = presentAdminResult(result);
    await this.sendMessage(chatId, presentation.message, presentation.sendOptions);
  }
  /** Inputs: chat ID. Lists active group bans and administrators. Output: the sent-message promise. */
  async handleConfig(chatId) {
    const presentation = presentAdminResult(adminService.getConfiguration(chatId, this.adminStore));
    await this.sendMessage(chatId, presentation.message, presentation.sendOptions);
  }
  /** Inputs: chat ID and mentioned user. Clears an active ban. Output: confirmation or validation response. */
  async handleUnban(chatId, args, quotedMessage, sender, command, message) {
    const presentation = presentAdminResult(
      adminService.unbanUser({ chatId, senderId: sender?.mentionId, userId: message.mentionedIds?.[0] }, this.adminStore),
    );
    await this.sendMessage(chatId, presentation.message, presentation.sendOptions);
  }
  /** Inputs: chat ID and mentioned user. Grants group-admin access. Output: confirmation or validation response. */
  async handleAdmin(chatId, args, quotedMessage, sender, command, message) {
    const presentation = presentAdminResult(
      adminService.addAdmin({ chatId, senderId: sender?.mentionId, userId: message.mentionedIds?.[0] }, this.adminStore),
    );
    await this.sendMessage(chatId, presentation.message, presentation.sendOptions);
  }
  /** Inputs: chat ID and mentioned user. Revokes group-admin access. Output: confirmation or validation response. */
  async handleNoAdmin(chatId, args, quotedMessage, sender, command, message) {
    const presentation = presentAdminResult(
      adminService.removeAdmin({ chatId, senderId: sender?.mentionId, userId: message.mentionedIds?.[0] }, this.adminStore),
    );
    await this.sendMessage(chatId, presentation.message, presentation.sendOptions);
  }
  /** Inputs: chat ID and duration. Pauses non-admin bot responses in the group. Output: confirmation or validation response. */
  async handlePause(chatId, args, quotedMessage, sender) {
    const presentation = presentAdminResult(
      adminService.pauseBot({ chatId, senderId: sender?.mentionId, argumentCount: args.length, durationText: args[0] }, this.adminStore),
    );
    await this.sendMessage(chatId, presentation.message, presentation.sendOptions);
  }
  /** Inputs: chat ID and sender. Clears the group pause. Output: confirmation or permission response. */
  async handleUnpause(chatId, args, quotedMessage, sender) {
    const presentation = presentAdminResult(adminService.unpauseBot({ chatId, senderId: sender?.mentionId }, this.adminStore));
    await this.sendMessage(chatId, presentation.message, presentation.sendOptions);
  }

  /** Inputs: chat ID. Finds the active or next recurring class. Output: the sent-message promise. */
  async handleCurrentClass(chatId) {
    const result = classService.getCurrentClass(chatId, this.classStore);
    await this.sendMessage(chatId, presentClassResult(result).message);
  }

  /** Inputs: chat ID. Lists today's scheduled classes. Output: the sent-message promise. */
  async handleClassesToday(chatId) {
    const result = classService.listClassesToday(chatId, undefined, this.classStore);
    await this.sendMessage(chatId, presentClassResult(result).message);
  }

  /** Inputs: chat ID. Lists all classes grouped by weekday. Output: the sent-message promise. */
  async handleAllClasses(chatId) {
    const result = classService.listClasses(chatId, this.classStore);
    await this.sendMessage(chatId, presentClassResult(result).message);
  }

  /** Inputs: chat ID and class fields. Validates and stores a class. Output: confirmation or validation response. */
  async handleAddClass(chatId, args) {
    const result = classService.addClassFromCommand({ chatId, args }, this.classStore, this.classScheduler);
    await this.sendMessage(chatId, presentClassResult(result).message);
  }

  /** Inputs: chat ID and class update fields. Validates and updates a class. Output: confirmation or validation response. */
  async handleEditClass(chatId, args) {
    const input = args.join(" "),
      comma = input.indexOf(",");
    const parsedUpdates = classService.parseClassUpdates(comma === -1 ? undefined : input.slice(comma + 1));
    if (!parsedUpdates.ok) return this.sendMessage(chatId, presentClassResult(parsedUpdates).message);

    const result = classService.updateClass(
      { chatId, reference: input.slice(0, comma).trim(), updates: parsedUpdates.data.updates },
      this.classStore,
      this.classScheduler,
    );
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

}

function splitWeatherArguments(args) {
  for (const dateArgumentCount of [2, 1]) {
    if (args.length < dateArgumentCount) continue;
    const date = args.slice(0, dateArgumentCount).join(" ");
    if (resolveMexicoCityDate(date)) return { date, location: args.slice(dateArgumentCount).join(" ") || undefined };
  }
  return { date: undefined, location: args.join(" ") || undefined };
}

function parsePollArguments(args) {
  const [title = "", ...options] = args.join(" ").split(",").map((value) => value.trim());
  return { title, options: options.filter(Boolean) };
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
const { AsyncLocalStorage } = require("node:async_hooks");
