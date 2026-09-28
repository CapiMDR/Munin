const { MESSAGES } = require("./messages");

function presentSummaryResult(result) {
  if (result.ok) return { ok: true, action: "summarize_messages", ...result.data };
  const message = result.code === "SUMMARY_EMPTY" ? MESSAGES.SUMMARY_NO_MESSAGES : MESSAGES.SUMMARY_USAGE(result.data.maxAmount);
  return { ok: false, code: result.code, message };
}

module.exports = { presentSummaryResult };
