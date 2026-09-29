const { failure, success } = require("./result");
function getUserStats({ chatId, mentionId, mentionedCount = 0 }, userStatsStore) {
  if (mentionedCount > 1) return failure("USER_STATS_MENTIONS_INVALID");
  const stats = userStatsStore?.get(chatId, mentionId);
  return stats ? success("USER_STATS_FOUND", { stats }) : failure("USER_STATS_UNAVAILABLE");
}
module.exports = { getUserStats };
