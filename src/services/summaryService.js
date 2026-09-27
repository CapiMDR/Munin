const { failure, success } = require("./result");

function prepareSummary({ chatId, amount, excludedMessage }, summarizer) {
  const maxAmount = summarizer?.maxAmount;
  if (!Number.isInteger(maxAmount) || !Number.isInteger(amount) || amount < 1 || amount > maxAmount) {
    return failure("SUMMARY_AMOUNT_INVALID", { maxAmount });
  }
  const conversation = summarizer.formatRecentMessages(chatId, amount, excludedMessage);
  return conversation ? success("SUMMARY_PREPARED", { amount, conversation }) : failure("SUMMARY_EMPTY");
}

module.exports = { prepareSummary };
