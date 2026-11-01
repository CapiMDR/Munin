const { failure, success } = require("../../core/result");
const { partitionOneBasedIndexes } = require("../../utils/indexUtils");

function saveCronometer({ chatId, title, now = Date.now() }, cronometerStore) {
  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  if (!normalizedTitle) return failure("CRONOMETER_TITLE_REQUIRED");
  const cronometer = cronometerStore.add(chatId, normalizedTitle, now);
  return success("CRONOMETER_SAVED", { cronometer, cronometers: cronometerStore.getAll(chatId) });
}

function listCronometers({ chatId }, cronometerStore) {
  return success("CRONOMETERS_LISTED", { cronometers: cronometerStore.getAll(chatId) });
}

function deleteCronometers({ chatId, indexes }, cronometerStore) {
  if (!Array.isArray(indexes) || !indexes.length) return failure("CRONOMETER_INDEX_INVALID");
  const { valid, invalid } = partitionOneBasedIndexes(indexes, cronometerStore.getAll(chatId).length);
  const deleted = valid
    .sort((left, right) => right - left)
    .map((index) => ({ index, cronometer: cronometerStore.remove(chatId, index - 1) }))
    .reverse();
  return success("CRONOMETERS_DELETED", { deleted, invalidIndexes: invalid, cronometers: cronometerStore.getAll(chatId) });
}

module.exports = { deleteCronometers, listCronometers, saveCronometer };
