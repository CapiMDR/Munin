const { MESSAGES } = require("./messages");
function presentStatsResult(result) {
  return result.ok
    ? { ok: true, action: "show_user_stats", message: MESSAGES.USER_STATS(result.data.stats) }
    : { ok: false, code: result.code, message: MESSAGES.STATS_UNAVAILABLE };
}
module.exports = { presentStatsResult };
