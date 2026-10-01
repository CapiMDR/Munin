const { INFINITE_TOKEN } = require("../../config/commandConstants");
const { parseDuration } = require("../../utils/timeUtils");
const { failure, success } = require("../../core/result");

function banUser({ chatId, senderId, userId, argumentCount, durationText }, adminStore) {
  if (!adminStore.isAdmin(chatId, senderId)) return failure("ADMIN_FORBIDDEN");

  const isIndefinite = durationText?.toLowerCase() === INFINITE_TOKEN;
  const duration = parseDuration(durationText);
  if (!userId || argumentCount !== 2 || (!isIndefinite && !duration)) return failure("ADMIN_BAN_INPUT_INVALID");

  if (isIndefinite) {
    adminStore.banIndefinitely(chatId, userId);
    return success("ADMIN_USER_BANNED_INDEFINITELY");
  }

  adminStore.ban(chatId, userId, Date.now() + duration);
  return success("ADMIN_USER_BANNED", { durationText });
}

function getConfiguration(chatId, adminStore) {
  const bans = adminStore.getBans(chatId);
  const admins = adminStore.getAdmins(chatId);
  const mentions = [...new Set([...bans.map(({ userId }) => userId), ...admins])];
  return success("ADMIN_CONFIGURATION", { admins, bans, mentions });
}

function unbanUser({ chatId, senderId, userId }, adminStore) {
  if (!adminStore.isAdmin(chatId, senderId)) return failure("ADMIN_FORBIDDEN");
  if (!userId) return failure("ADMIN_UNBAN_INPUT_INVALID");
  return success(adminStore.unban(chatId, userId) ? "ADMIN_USER_UNBANNED" : "ADMIN_USER_NOT_BANNED");
}

function addAdmin({ chatId, senderId, userId }, adminStore) {
  if (!adminStore.isAdmin(chatId, senderId)) return failure("ADMIN_FORBIDDEN");
  if (!userId) return failure("ADMIN_ADD_INPUT_INVALID");
  adminStore.addAdmin(chatId, userId);
  return success("ADMIN_ADDED");
}

function removeAdmin({ chatId, senderId, userId }, adminStore) {
  if (!adminStore.isAdmin(chatId, senderId)) return failure("ADMIN_FORBIDDEN");
  if (!userId) return failure("ADMIN_REMOVE_INPUT_INVALID");
  return success(adminStore.removeAdmin(chatId, userId) ? "ADMIN_REMOVED" : "ADMIN_GLOBAL_PROTECTED");
}

function pauseBot({ chatId, senderId, argumentCount, durationText }, adminStore) {
  if (!adminStore.isAdmin(chatId, senderId)) return failure("ADMIN_FORBIDDEN");

  const isIndefinite = durationText?.toLowerCase() === INFINITE_TOKEN;
  const duration = parseDuration(durationText);
  if (argumentCount !== 1 || (!isIndefinite && !duration)) return failure("ADMIN_PAUSE_INPUT_INVALID");

  if (isIndefinite) {
    adminStore.pauseIndefinitely(chatId);
    return success("ADMIN_BOT_PAUSED_INDEFINITELY");
  }

  adminStore.pause(chatId, Date.now() + duration);
  return success("ADMIN_BOT_PAUSED", { durationText });
}

function unpauseBot({ chatId, senderId }, adminStore) {
  if (!adminStore.isAdmin(chatId, senderId)) return failure("ADMIN_FORBIDDEN");
  return success(adminStore.unpause(chatId) ? "ADMIN_BOT_UNPAUSED" : "ADMIN_BOT_NOT_PAUSED");
}

module.exports = { addAdmin, banUser, getConfiguration, pauseBot, removeAdmin, unbanUser, unpauseBot };
