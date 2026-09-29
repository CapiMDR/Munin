const { MESSAGES } = require("./messages");

function presentStatsResult(result) {
  if (!result.ok && result.code === "USER_STATS_MENTIONS_INVALID") {
    return { ok: false, code: result.code, message: MESSAGES.STATS_USAGE };
  }
  return result.ok
    ? { ok: true, action: "show_user_stats", message: MESSAGES.USER_STATS(result.data.stats) }
    : { ok: false, code: result.code, message: MESSAGES.STATS_UNAVAILABLE };
}
module.exports = { presentStatsResult };
