const { failure, success } = require("./result");

function createPending({ chatId, content, date, time }, pendingStore) {
  if (!content) return failure("PENDING_CONTENT_REQUIRED");
  if (date === null) return failure("PENDING_DATE_INVALID");
  if (time === null) return failure("PENDING_TIME_INVALID");
  const pending = pendingStore.add(chatId, content, date, time);
  return success("PENDING_CREATED", { pending, pendings: pendingStore.getAll(chatId) });
}

function listPendings(chatId, pendingStore) {
  return success("PENDINGS_LISTED", { pendings: pendingStore.getAll(chatId) });
}

function deletePending(chatId, index, pendingStore) {
  if (!Number.isInteger(index) || index < 0) return failure("PENDING_INDEX_INVALID");
  const pending = pendingStore.remove(chatId, index);
  return pending ? success("PENDING_DELETED", { pending, pendings: pendingStore.getAll(chatId) }) : failure("PENDING_NOT_FOUND");
}

module.exports = { createPending, deletePending, listPendings };
