const { COMMANDS } = require("../../config/commandConstants");
const { formatMexicoCityDateTime } = require("../../utils/timeUtils");

const SAVED_MESSAGES_USAGE = `Uso:\n${COMMANDS.SAVED_MESSAGES} para ver los mensajes guardados\nResponde a un mensaje con ${COMMANDS.SAVED_MESSAGES} <título> para guardarlo\n${COMMANDS.SAVED_MESSAGES} - <índice1> ... <índiceN> para eliminarlos`;
const VIEW_SAVED_MESSAGE_USAGE = `Uso: ${COMMANDS.VIEW_SAVED_MESSAGE} <título>`;

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
  if (result.code === "SAVED_MESSAGES_DELETED") {
    const { deleted, invalidIndexes } = result.data;
    const confirmation = deleted.length
      ? `${deleted.length === 1 ? "Mensaje guardado eliminado" : "Mensajes guardados eliminados"}: ${deleted.map(({ title }) => title).join(", ")}`
      : "No se eliminó ningún mensaje guardado.";
    const clarification = invalidIndexes.length ? `\nNo encontré los índices: ${invalidIndexes.join(", ")}.` : "";
    return { ok: true, action: "delete_saved_messages", message: `${confirmation}${clarification}` };
  }
  if (result.code === "SAVED_MESSAGE_FOUND") {
    return {
      ok: true,
      action: "view_saved_message",
      message: `Mensaje guardado: ${result.data.savedMessage.title}\nFecha de guardado: ${formatSavedAt(result.data.savedMessage.savedAt)}`,
      sendOptions: { quotedMessageId: result.data.savedMessage.messageId },
    };
  }
  return { ok: false, code: "SAVED_MESSAGE_RESULT_UNKNOWN", message: SAVED_MESSAGES_USAGE };
}

function getSavedMessageUsage(title) {
  return `> Usa *${COMMANDS.VIEW_SAVED_MESSAGE} ${title}* para verlo\n> Usa *${COMMANDS.SAVED_MESSAGES}* para ver todos los mensajes guardados`;
}

function getSavedMessageErrorMessage(code, title) {
  if (code === "SAVED_MESSAGE_NOT_FOUND") return `No existe un mensaje guardado con el título: ${title}`;
  if (code === "SAVED_MESSAGE_TITLE_INVALID") return VIEW_SAVED_MESSAGE_USAGE;
  if (code === "SAVED_MESSAGE_INDEX_INVALID") return SAVED_MESSAGES_USAGE;
  return SAVED_MESSAGES_USAGE;
}

function formatSavedMessages(savedMessages) {
  return savedMessages.length
    ? `🐦‍⬛ Mensajes guardados de este grupo.\nUsa ${COMMANDS.VIEW_SAVED_MESSAGE} <nombre> para verlos:\n${savedMessages.map((message, index) => `${index + 1}. ${message.title}\nFecha de guardado: ${formatSavedAt(message.savedAt)}`).join("\n\n")}\n\n> Responde a un mensaje con *${COMMANDS.SAVED_MESSAGES} reglas* para guardarlo.\n> Usa *${COMMANDS.SAVED_MESSAGES} - <índice1> ... <índiceN>* para eliminarlos.`
    : `No hay mensajes guardados en este grupo.\n\n> Responde a un mensaje con *${COMMANDS.SAVED_MESSAGES} reglas* para guardarlo.`;
}

function formatSavedAt(savedAt) {
  return Number.isFinite(Date.parse(savedAt)) ? formatMexicoCityDateTime(savedAt) : "No disponible";
}

module.exports = { formatSavedMessages, presentSavedMessageResult };
