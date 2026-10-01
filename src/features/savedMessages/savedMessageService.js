const { failure, success } = require("../../core/result");
function saveMessage({ chatId, title, quotedStanzaId, quotedParticipant, botLid, senderMentionId }, savedMessageStore, userStatsStore) {
  if (!title || !quotedStanzaId || !quotedParticipant) return failure("SAVED_MESSAGE_INPUT_INVALID");

  const participant = typeof quotedParticipant === "string" ? quotedParticipant : quotedParticipant._serialized;
  if (!participant) return failure("SAVED_MESSAGE_INPUT_INVALID");

  const messageId = `${participant === botLid}_${chatId}_${quotedStanzaId}_${participant}`;
  const updated = savedMessageStore.set(chatId, title, messageId);
  userStatsStore?.recordAction(chatId, senderMentionId, "messagesSaved");
  return success(updated ? "SAVED_MESSAGE_UPDATED" : "SAVED_MESSAGE_CREATED", { title, updated, messageId });
}

function getSavedMessage(chatId, title, savedMessageStore) {
  if (!title) return failure("SAVED_MESSAGE_TITLE_INVALID");
  const savedMessage = savedMessageStore.get(chatId, title);
  return savedMessage ? success("SAVED_MESSAGE_FOUND", { savedMessage }) : failure("SAVED_MESSAGE_NOT_FOUND");
}

function listSavedMessages(chatId, savedMessageStore) {
  return success("SAVED_MESSAGES_LISTED", { savedMessages: savedMessageStore.getAll(chatId) });
}

function deleteSavedMessage(chatId, index, savedMessageStore) {
  if (!Number.isInteger(index) || index < 0) return failure("SAVED_MESSAGE_INDEX_INVALID");
  const savedMessage = savedMessageStore.removeAt(chatId, index);
  return savedMessage ? success("SAVED_MESSAGE_DELETED", { savedMessage }) : failure("SAVED_MESSAGE_INDEX_NOT_FOUND");
}

module.exports = { deleteSavedMessage, getSavedMessage, listSavedMessages, saveMessage };
