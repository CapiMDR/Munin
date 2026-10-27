const { failure, success } = require("../../core/result");
const { partitionOneBasedIndexes } = require("../../utils/indexUtils");
function saveMessage({ chatId, title, quotedStanzaId, quotedParticipant, botLid, senderMentionId, savedAt }, savedMessageStore, userStatsStore) {
  if (!title || !quotedStanzaId || !quotedParticipant) return failure("SAVED_MESSAGE_INPUT_INVALID");

  const participant = typeof quotedParticipant === "string" ? quotedParticipant : quotedParticipant._serialized;
  if (!participant) return failure("SAVED_MESSAGE_INPUT_INVALID");

  const messageId = `${participant === botLid}_${chatId}_${quotedStanzaId}_${participant}`;
  const updated = savedMessageStore.set(chatId, title, messageId, normalizeSavedAt(savedAt));
  userStatsStore?.recordAction(chatId, senderMentionId, "messagesSaved");
  return success(updated ? "SAVED_MESSAGE_UPDATED" : "SAVED_MESSAGE_CREATED", { title, updated, messageId });
}

function normalizeSavedAt(timestamp) {
  const seconds = Number(timestamp);
  return Number.isFinite(seconds) ? new Date(seconds * 1_000).toISOString() : null;
}

function getSavedMessage(chatId, title, savedMessageStore) {
  if (!title) return failure("SAVED_MESSAGE_TITLE_INVALID");
  const savedMessage = savedMessageStore.get(chatId, title);
  return savedMessage ? success("SAVED_MESSAGE_FOUND", { savedMessage }) : failure("SAVED_MESSAGE_NOT_FOUND");
}

function listSavedMessages(chatId, savedMessageStore) {
  return success("SAVED_MESSAGES_LISTED", { savedMessages: savedMessageStore.getAll(chatId) });
}

function deleteSavedMessages(chatId, indexes, savedMessageStore) {
  if (!Array.isArray(indexes) || !indexes.length) return failure("SAVED_MESSAGE_INDEX_INVALID");

  const { valid, invalid } = partitionOneBasedIndexes(indexes, savedMessageStore.getAll(chatId).length);
  const deleted = savedMessageStore.removeAtMany(chatId, valid.map((index) => index - 1));
  return success("SAVED_MESSAGES_DELETED", { deleted, invalidIndexes: invalid });
}

module.exports = { deleteSavedMessages, getSavedMessage, listSavedMessages, saveMessage };
