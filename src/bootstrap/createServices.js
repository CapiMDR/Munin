const { Summarizer } = require("../ai/summarizer");
const { TriviaManager } = require("../services/triviaManager");

/**
 * Creates stateful application services that depend on shared infrastructure.
 * @param {object} infrastructure Shared infrastructure dependencies.
 * @returns {{summarizer: Summarizer, triviaManager: TriviaManager}} Stateful services.
 */
function createServices({ sendMessage, stores }) {
  const summarizer = new Summarizer();
  const triviaManager = new TriviaManager({
    sendMessage,
    getPlayerName: (chatId, mentionId) => stores.userStats.get(chatId, mentionId)?.name || mentionId,
    recordTriviaGamePlayed: (chatId, mentionId) => stores.userStats.recordTriviaGamePlayed(chatId, mentionId),
    recordTriviaAnswer: (chatId, mentionId, correct) => stores.userStats.recordTriviaAnswer(chatId, mentionId, correct),
    recordTriviaGameWon: (chatId, mentionId) => stores.userStats.recordTriviaGameWon(chatId, mentionId),
  });

  return { summarizer, triviaManager };
}

module.exports = { createServices };
