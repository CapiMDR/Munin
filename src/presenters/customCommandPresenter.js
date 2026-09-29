const { COMMANDS } = require("../config/commandConstants");

const CUSTOM_COMMAND_USAGE = `Uso: ${COMMANDS.CREATE_CUSTOM_COMMAND} !<nombre> <respuesta>`;

function presentCustomCommandResult(result) {
  if (!result.ok) {
    if (result.code === "CUSTOM_COMMAND_BUILTIN")
      return { ok: false, code: result.code, message: `No puedes sobrescribir ${result.data.command} porque es un comando del bot.` };
    if (result.code === "CUSTOM_COMMAND_NOT_FOUND")
      return { ok: false, code: result.code, message: "No existe un comando personalizado con ese índice." };
    if (result.code === "CUSTOM_COMMAND_INDEX_INVALID")
      return { ok: false, code: result.code, message: `Uso: ${COMMANDS.CREATE_CUSTOM_COMMAND} - <índice>` };
    return { ok: false, code: result.code, message: CUSTOM_COMMAND_USAGE };
  }
  if (result.code === "CUSTOM_COMMANDS_LISTED") {
    const { commands } = result.data;
    return {
      ok: true,
      action: "list_custom_commands",
      message: commands.length
        ? `Comandos personalizados:\n${commands.map((command, index) => `${index + 1}. ${command.command}`).join("\n")}`
        : "No hay comandos personalizados en este grupo.",
    };
  }
  if (result.code === "CUSTOM_COMMAND_DELETED")
    return { ok: true, action: "delete_custom_command", message: `Comando personalizado eliminado: ${result.data.deletedCommand.command}` };
  return {
    ok: true,
    action: "create_custom_command",
    message: result.data.updated
      ? `Comando personalizado actualizado: ${result.data.command}`
      : `Cuando digas ${result.data.command} diré ${result.data.reply}`,
  };
}

module.exports = { presentCustomCommandResult };
