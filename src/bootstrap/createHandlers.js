const { createAiToolExecutor } = require("../handlers/aiToolExecutor");
const { createMessageHandler } = require("../handlers/messageHandler");
const CommandHandler = require("../handlers/commandHandler");
const { loadBotLid, saveBotLid } = require("../core/botIdentityStore");

/**
 * Creates handlers and wires their circular command/AI dispatch relationship.
 * @param {object} dependencies Handler dependencies grouped by layer.
 * @returns {object} Configured message, command, and AI tool handlers.
 */
function createHandlers({ ai, infrastructure, services }) {
  const { apis, output, schedulers, sendMessage, stores } = infrastructure;
  const { summarizer, triviaManager } = services;
  let aiToolExecutor;
  let commandHandler;
  const messageHandler = createMessageHandler({
    initialBotLid: loadBotLid(),
    saveBotLid,
    getCommandHandler: () => commandHandler,
    adminStore: stores.admins,
    userStatsStore: stores.userStats,
    summarizer,
    triviaManager,
    shouldAwardFeather: ai.shouldAwardFeather,
    generateResponse: ai.generateResponse,
    aiToolExecutor: { execute: (...args) => aiToolExecutor.execute(...args) },
    completeToolCall: ai.completeToolCall,
    output,
    scheduleTimer: schedulers.scheduleTimer,
  });

  aiToolExecutor = createAiToolExecutor({
    pendingStore: stores.pending,
    reminderStore: stores.reminders,
    reminderScheduler: schedulers.reminders,
    savedMessageStore: stores.savedMessages,
    eventStore: stores.events,
    customCommandStore: stores.customCommands,
    userStatsStore: stores.userStats,
    adminStore: stores.admins,
    output,
    openMeteoApi: apis.weather,
    openTriviaApi: apis.trivia,
    translateTrivia: ai.translateTrivia,
    triviaManager,
    classStore: stores.classes,
    classScheduler: schedulers.classes,
    eventStore: stores.events,
    eventScheduler: schedulers.events,
    sendMessage,
    summarizer,
  });
  commandHandler = new CommandHandler({
    pendingStore: stores.pending,
    reminderStore: stores.reminders,
    reminderScheduler: schedulers.reminders,
    classStore: stores.classes,
    classScheduler: schedulers.classes,
    adminStore: stores.admins,
    customCommandStore: stores.customCommands,
    savedMessageStore: stores.savedMessages,
    getBotLid: messageHandler.getBotLid,
    summarizer,
    generateSummary: ai.generateSummary,
    suggestSimilarCommand: ai.suggestSimilarCommand,
    userStatsStore: stores.userStats,
    weeklyReportStore: stores.weeklyReports,
    openMeteoApi: apis.weather,
    openTriviaApi: apis.trivia,
    translateTrivia: ai.translateTrivia,
    triviaManager,
  });

  return { aiToolExecutor, commandHandler, messageHandler };
}

module.exports = { createHandlers };
