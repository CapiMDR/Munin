const { MESSAGES } = require("./messages");

function presentSavedMessageResult(result, { title } = {}) {
  if (!result.ok) {
    const message = result.code === "SAVED_MESSAGE_NOT_FOUND" ? MESSAGES.SAVED_MESSAGE_NOT_FOUND(title) : MESSAGES.SAVE_MESSAGE_USAGE;
    return { ok: false, code: result.code, message };
  }

  if (result.code === "SAVED_MESSAGE_CREATED" || result.code === "SAVED_MESSAGE_UPDATED") {
    return {
      ok: true,
      action: "save_message",
      message: result.data.updated ? MESSAGES.SAVED_MESSAGE_UPDATED(result.data.title) : MESSAGES.SAVED_MESSAGE_CREATED(result.data.title),
    };
  }
  if (result.code === "SAVED_MESSAGES_LISTED") {
    return { ok: true, action: "list_saved_messages", message: formatSavedMessages(result.data.savedMessages) };
  }
  if (result.code === "SAVED_MESSAGE_DELETED") {
    return { ok: true, action: "delete_saved_message", message: MESSAGES.SAVED_MESSAGE_DELETED(result.data.savedMessage.title) };
  }
  if (result.code === "SAVED_MESSAGE_FOUND") {
    return {
      ok: true,
      action: "view_saved_message",
      message: MESSAGES.SAVED_MESSAGE_REPLY(result.data.savedMessage.title),
      sendOptions: { quotedMessageId: result.data.savedMessage.messageId },
    };
  }
  return { ok: false, code: "SAVED_MESSAGE_RESULT_UNKNOWN", message: MESSAGES.SAVE_MESSAGE_USAGE };
}

function formatSavedMessages(savedMessages) {
  return savedMessages.length ? MESSAGES.SAVED_MESSAGES_LIST(savedMessages) : MESSAGES.NO_SAVED_MESSAGES;
}

module.exports = { formatSavedMessages, presentSavedMessageResult };
