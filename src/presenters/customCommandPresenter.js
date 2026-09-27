const { MESSAGES } = require("../commandConstants");
function presentCustomCommandResult(result) {
  if (!result.ok) {
    if (result.code === "CUSTOM_COMMAND_BUILTIN")
      return { ok: false, code: result.code, message: MESSAGES.CUSTOM_COMMAND_BUILTIN_CONFLICT(result.data.command) };
    if (result.code === "CUSTOM_COMMAND_NOT_FOUND") return { ok: false, code: result.code, message: MESSAGES.CUSTOM_COMMAND_INDEX_NOT_FOUND };
    if (result.code === "CUSTOM_COMMAND_INDEX_INVALID") return { ok: false, code: result.code, message: MESSAGES.DELETE_CUSTOM_COMMAND_USAGE };
    return { ok: false, code: result.code, message: MESSAGES.CUSTOM_COMMAND_USAGE };
  }
  if (result.code === "CUSTOM_COMMANDS_LISTED")
    return {
      ok: true,
      action: "list_custom_commands",
      message: result.data.commands.length ? MESSAGES.CUSTOM_COMMANDS_LIST(result.data.commands) : MESSAGES.NO_CUSTOM_COMMANDS,
    };
  if (result.code === "CUSTOM_COMMAND_DELETED")
    return { ok: true, action: "delete_custom_command", message: MESSAGES.CUSTOM_COMMAND_DELETED(result.data.deletedCommand.command) };
  return {
    ok: true,
    action: "create_custom_command",
    message: result.data.updated
      ? MESSAGES.CUSTOM_COMMAND_UPDATED(result.data.command)
      : MESSAGES.CUSTOM_COMMAND_CREATED(result.data.command, result.data.reply),
  };
}
module.exports = { presentCustomCommandResult };
