const { MESSAGES } = require("../commandConstants");
function presentTriviaResult(result) {
  if (result.ok) return { ok: true, action: "start_trivia" };
  return { ok: false, code: result.code, message: result.code === "TRIVIA_AMOUNT_INVALID" ? MESSAGES.TRIVIA_USAGE : MESSAGES.TRIVIA_UNAVAILABLE };
}
module.exports = { presentTriviaResult };
