const { MESSAGES } = require("./messages");
const { formatDuration, formatRemainingDuration } = require("../utils/timeUtils");

function presentAdminResult(result) {
  if (!result.ok) return { ok: false, code: result.code, message: getAdminErrorMessage(result.code) };

  switch (result.code) {
    case "ADMIN_USER_BANNED":
      return { ok: true, action: "ban_user", message: MESSAGES.USER_BANNED(formatDuration(result.data.durationText)) };
    case "ADMIN_USER_BANNED_INDEFINITELY":
      return { ok: true, action: "ban_user", message: MESSAGES.USER_BANNED_INDEFINITELY };
    case "ADMIN_CONFIGURATION": {
      const bans = result.data.bans.map((ban) => ({
        ...ban,
        remaining: ban.isIndefinite ? "indefinidamente" : formatRemainingDuration(ban.until - Date.now()),
      }));
      return {
        ok: true,
        action: "show_configuration",
        message: MESSAGES.CONFIG_LIST(bans, result.data.admins),
        sendOptions: result.data.mentions.length ? { mentions: result.data.mentions } : undefined,
      };
    }
    case "ADMIN_USER_UNBANNED":
      return { ok: true, action: "unban_user", message: MESSAGES.USER_UNBANNED };
    case "ADMIN_USER_NOT_BANNED":
      return { ok: true, action: "unban_user", message: MESSAGES.USER_NOT_BANNED };
    case "ADMIN_ADDED":
      return { ok: true, action: "add_admin", message: MESSAGES.ADMIN_ADDED };
    case "ADMIN_REMOVED":
      return { ok: true, action: "remove_admin", message: MESSAGES.ADMIN_REMOVED };
    case "ADMIN_GLOBAL_PROTECTED":
      return { ok: true, action: "remove_admin", message: MESSAGES.GLOBAL_ADMIN_PROTECTED };
    case "ADMIN_BOT_PAUSED":
      return { ok: true, action: "pause_bot", message: MESSAGES.BOT_PAUSED(formatDuration(result.data.durationText)) };
    case "ADMIN_BOT_PAUSED_INDEFINITELY":
      return { ok: true, action: "pause_bot", message: MESSAGES.BOT_PAUSED_INDEFINITELY };
    case "ADMIN_BOT_UNPAUSED":
      return { ok: true, action: "unpause_bot", message: MESSAGES.BOT_UNPAUSED };
    case "ADMIN_BOT_NOT_PAUSED":
      return { ok: true, action: "unpause_bot", message: MESSAGES.BOT_NOT_PAUSED };
    default:
      return { ok: false, code: "ADMIN_RESULT_UNKNOWN", message: MESSAGES.ADMIN_ONLY };
  }
}

function getAdminErrorMessage(code) {
  if (code === "ADMIN_FORBIDDEN") return MESSAGES.ADMIN_ONLY;
  if (code === "ADMIN_BAN_INPUT_INVALID") return MESSAGES.BAN_USAGE;
  if (code === "ADMIN_UNBAN_INPUT_INVALID") return MESSAGES.UNBAN_USAGE;
  if (code === "ADMIN_ADD_INPUT_INVALID") return MESSAGES.ADMIN_USAGE;
  if (code === "ADMIN_REMOVE_INPUT_INVALID") return MESSAGES.NO_ADMIN_USAGE;
  if (code === "ADMIN_PAUSE_INPUT_INVALID") return MESSAGES.PAUSE_USAGE;
  return MESSAGES.ADMIN_ONLY;
}

module.exports = { presentAdminResult };
