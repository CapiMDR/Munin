const { failure, success } = require("./result");
const { parsePendingDate, parsePendingTime } = require("../utils/pendingUtils");
const { partitionOneBasedIndexes } = require("../utils/indexUtils");

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

function createPendingFromCommand({ chatId, args, quotedContent }, pendingStore) {
  const { date, argumentCount: dateArgumentCount } = parsePendingDateArguments(args);
  if (args[0]?.startsWith("@") && !date) return failure("PENDING_DATE_INVALID");

  const timeIndex = date ? dateArgumentCount : 0;
  const time = parsePendingTime(args[timeIndex]);
  if (/^\d{1,2}:\d{2}$/.test(args[timeIndex] || "") && !time) return failure("PENDING_TIME_INVALID");

  const content =
    args
      .slice((date ? dateArgumentCount : 0) + (time ? 1 : 0))
      .join(" ")
      .trim() || quotedContent?.trim();
  return createPending({ chatId, content, date, time }, pendingStore);
}

function deletePending(chatId, index, pendingStore) {
  if (!Number.isInteger(index) || index < 0) return failure("PENDING_INDEX_INVALID");
  const pending = pendingStore.remove(chatId, index);
  return pending ? success("PENDING_DELETED", { index: index + 1, pending, pendings: pendingStore.getAll(chatId) }) : failure("PENDING_NOT_FOUND");
}

function deletePendings(chatId, indexes, pendingStore) {
  if (!Array.isArray(indexes) || !indexes.length) return failure("PENDING_INDEX_INVALID");
  const { valid, invalid } = partitionOneBasedIndexes(indexes, pendingStore.getAll(chatId).length);
  const deleted = valid
    .sort((a, b) => b - a)
    .map((index) => ({ index, pending: pendingStore.remove(chatId, index - 1) }))
    .reverse();
  return success("PENDINGS_DELETED", { deleted, invalidIndexes: invalid, pendings: pendingStore.getAll(chatId) });
}

function updatePending({ chatId, index, content, date, time, invalidDate, invalidTime }, pendingStore) {
  if (!Number.isInteger(index) || index < 0) return failure("PENDING_INDEX_INVALID");
  const current = pendingStore.getAll(chatId)[index];
  if (!current) return failure("PENDING_NOT_FOUND");
  if (content === undefined && date === undefined && time === undefined) return failure("PENDING_UPDATE_REQUIRED");
  if (content !== undefined && !content?.trim()) return failure("PENDING_CONTENT_REQUIRED");
  if (invalidDate) return failure("PENDING_DATE_INVALID");
  if (invalidTime) return failure("PENDING_TIME_INVALID");
  const pending = pendingStore.update(chatId, index, {
    ...(content !== undefined ? { content: content.trim() } : {}),
    ...(date !== undefined ? { date } : {}),
    ...(time !== undefined ? { time } : {}),
  });
  return success("PENDING_UPDATED", { index: index + 1, pending, pendings: pendingStore.getAll(chatId) });
}

function parsePendingDateArguments(args) {
  if (!args[0]?.startsWith("@")) return { date: undefined, argumentCount: 0 };
  for (const argumentCount of [2, 1]) {
    if (args.length < argumentCount) continue;
    const date = parsePendingDate(args.slice(0, argumentCount).join(" "));
    if (date) return { date, argumentCount };
  }
  return { date: undefined, argumentCount: 0 };
}

module.exports = { createPending, createPendingFromCommand, deletePending, deletePendings, listPendings, updatePending };
