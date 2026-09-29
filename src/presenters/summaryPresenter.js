const { MESSAGES } = require("./messages");

function presentSummaryResult(result) {
  if (result.ok && result.code === "SUMMARY_PREPARED") return { ok: true, action: "summarize_messages", ...result.data };
  if (result.ok && result.code === "SUMMARY_GENERATED") return { ok: true, action: "summarize_messages", message: result.data.summary };

  const message = getSummaryErrorMessage(result);
  return { ok: false, code: result.code, message };
}

function getSummaryErrorMessage(result) {
  if (result.code === "SUMMARY_EMPTY") return MESSAGES.SUMMARY_NO_MESSAGES;
  if (result.code === "SUMMARY_GENERATION_UNAVAILABLE") return MESSAGES.SUMMARY_UNAVAILABLE;
  return MESSAGES.SUMMARY_USAGE(result.data?.maxAmount);
}

module.exports = { presentSummaryResult };
