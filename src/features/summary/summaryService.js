const { failure, success } = require("../../core/result");

function prepareSummary({ chatId, amount, excludedMessage }, summarizer) {
  const maxAmount = summarizer?.maxAmount;
  if (!Number.isInteger(maxAmount) || !Number.isInteger(amount) || amount < 1 || amount > maxAmount) {
    return failure("SUMMARY_AMOUNT_INVALID", { maxAmount });
  }
  const conversation = summarizer.formatRecentMessages(chatId, amount, excludedMessage);
  return conversation ? success("SUMMARY_PREPARED", { amount, conversation }) : failure("SUMMARY_EMPTY");
}

async function generateSummary(conversation, summaryGenerator) {
  if (typeof summaryGenerator !== "function") return failure("SUMMARY_GENERATION_UNAVAILABLE");

  try {
    const summary = await summaryGenerator(conversation);
    return typeof summary === "string" && summary.trim()
      ? success("SUMMARY_GENERATED", { summary: summary.trim() })
      : failure("SUMMARY_GENERATION_UNAVAILABLE");
  } catch (error) {
    console.error("Could not generate summary:", error.message);
    return failure("SUMMARY_GENERATION_UNAVAILABLE");
  }
}

module.exports = { generateSummary, prepareSummary };
