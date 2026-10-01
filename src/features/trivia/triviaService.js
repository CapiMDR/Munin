const MIN_QUESTIONS = 1;
const MAX_QUESTIONS = 50;
const { failure, success } = require("../../core/result");

async function startTrivia({ chatId, amount }, { openTriviaApi, translateTrivia, triviaManager }) {
  if (!Number.isInteger(amount) || amount < MIN_QUESTIONS || amount > MAX_QUESTIONS) {
    return failure("TRIVIA_AMOUNT_INVALID");
  }
  if (triviaManager?.hasActiveSession(chatId)) {
    await triviaManager.rejectNewSession(chatId);
    return success("TRIVIA_ALREADY_ACTIVE", { rejected: true });
  }
  try {
    const triviaBatch = await openTriviaApi?.getTrivia(amount);
    const trivia = await translateTrivia?.(triviaBatch);
    if (!trivia) return failure("TRIVIA_UNAVAILABLE");
    await triviaManager?.start(chatId, trivia);
    return success("TRIVIA_STARTED");
  } catch (error) {
    console.error("Could not start trivia:", error.message);
    return failure("TRIVIA_UNAVAILABLE");
  }
}

module.exports = { MAX_QUESTIONS, MIN_QUESTIONS, startTrivia };
