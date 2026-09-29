const { failure, success } = require("./result");

function createCustomCommand({ chatId, command, reply, builtInCommands }, store) {
  const name = typeof command === "string" ? command.trim().toLowerCase() : "";
  const text = typeof reply === "string" ? reply.trim() : "";
  if (!/^![a-z0-9_-]+$/i.test(name) || !text) return failure("CUSTOM_COMMAND_INPUT_INVALID");
  if (builtInCommands.includes(name)) return failure("CUSTOM_COMMAND_BUILTIN", { command: name });
  const updated = store.set(chatId, name, text);
  return success(updated ? "CUSTOM_COMMAND_UPDATED" : "CUSTOM_COMMAND_CREATED", { command: name, reply: text, updated });
}
function listCustomCommands(chatId, store) {
  return success("CUSTOM_COMMANDS_LISTED", { commands: store.getAll(chatId) });
}
function deleteCustomCommand({ chatId, index }, store) {
  if (!Number.isInteger(index) || index < 1) return failure("CUSTOM_COMMAND_INDEX_INVALID");
  const deletedCommand = store.removeAt(chatId, index - 1);
  return deletedCommand ? success("CUSTOM_COMMAND_DELETED", { deletedCommand }) : failure("CUSTOM_COMMAND_NOT_FOUND");
}

function deleteCustomCommandByName({ chatId, command }, store) {
  const name = typeof command === "string" ? command.trim().toLowerCase() : "";
  if (!name) return failure("CUSTOM_COMMAND_NOT_FOUND");

  const reply = store.remove(chatId, name);
  return reply === undefined ? failure("CUSTOM_COMMAND_NOT_FOUND") : success("CUSTOM_COMMAND_DELETED", { deletedCommand: { command: name, reply } });
}

module.exports = { createCustomCommand, deleteCustomCommand, deleteCustomCommandByName, listCustomCommands };
