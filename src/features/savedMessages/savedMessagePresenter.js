const { COMMANDS } = require("../../config/commandConstants");

const SAVE_MESSAGE_USAGE = `Uso: responde a un mensaje con ${COMMANDS.SAVE_MESSAGE} <título>`;
const VIEW_SAVED_MESSAGE_USAGE = `Uso: ${COMMANDS.VIEW_SAVED_MESSAGE} <título>`;
const DELETE_SAVED_MESSAGE_USAGE = `Uso: ${COMMANDS.DELETE_SAVED_MESSAGE} <índice>`;

function presentSavedMessageResult(result, { title } = {}) {
  if (!result.ok) return { ok: false, code: result.code, message: getSavedMessageErrorMessage(result.code, title) };
  if (result.code === "SAVED_MESSAGE_CREATED" || result.code === "SAVED_MESSAGE_UPDATED") {
    return {
      ok: true,
      action: "save_message",
      message: `${result.data.updated ? "Mensaje guardado actualizado" : "Mensaje guardado"}: ${result.data.title}\n${getSavedMessageUsage(result.data.title)}`,
    };
  }
  if (result.code === "SAVED_MESSAGES_LISTED")
    return { ok: true, action: "list_saved_messages", message: formatSavedMessages(result.data.savedMessages) };
  if (result.code === "SAVED_MESSAGE_DELETED")
    return { ok: true, action: "delete_saved_message", message: `Mensaje guardado eliminado: ${result.data.savedMessage.title}` };
  if (result.code === "SAVED_MESSAGE_FOUND") {
    return {
      ok: true,
      action: "view_saved_message",
      message: `Mensaje guardado: ${result.data.savedMessage.title}`,
      sendOptions: { quotedMessageId: result.data.savedMessage.messageId },
    };
  }
  return { ok: false, code: "SAVED_MESSAGE_RESULT_UNKNOWN", message: SAVE_MESSAGE_USAGE };
}

function getSavedMessageUsage(title) {
  return `> Usa *${COMMANDS.VIEW_SAVED_MESSAGE} ${title}* para verlo\n> Usa *${COMMANDS.LIST_SAVED_MESSAGES}* para ver todos los mensajes guardados`;
}

function getSavedMessageErrorMessage(code, title) {
  if (code === "SAVED_MESSAGE_NOT_FOUND") return `No existe un mensaje guardado con el título: ${title}`;
  if (code === "SAVED_MESSAGE_TITLE_INVALID") return VIEW_SAVED_MESSAGE_USAGE;
  if (code === "SAVED_MESSAGE_INDEX_NOT_FOUND") return "No existe un mensaje guardado con ese índice.";
  if (code === "SAVED_MESSAGE_INDEX_INVALID") return DELETE_SAVED_MESSAGE_USAGE;
  return SAVE_MESSAGE_USAGE;
}

function formatSavedMessages(savedMessages) {
  return savedMessages.length
    ? `🐦‍⬛ Mensajes guardados de este grupo.\nUsa ${COMMANDS.VIEW_SAVED_MESSAGE} <nombre> para verlos:\n${savedMessages.map((message, index) => `${index + 1}. ${message.title}`).join("\n")}\n\n> Responde a un mensaje y dime *"Guarda esto como reglas"*.`
    : 'No hay mensajes guardados en este grupo.\n\n> Responde a un mensaje y dime *"Guarda esto como reglas"*.';
}

module.exports = { formatSavedMessages, presentSavedMessageResult };
