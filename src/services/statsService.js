const { failure, success } = require("./result");
function getUserStats({ chatId, mentionId }, userStatsStore) {
  const stats = userStatsStore?.get(chatId, mentionId);
  return stats ? success("USER_STATS_FOUND", { stats }) : failure("USER_STATS_UNAVAILABLE");
}
module.exports = { getUserStats };
