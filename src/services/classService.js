const { DAYS_ORDER, parseTimeRange } = require("../utils/timeUtils");
const { failure, success } = require("./result");

function listClasses(chatId, store) {
  return success("CLASSES_LISTED", listData(chatId, store));
}
function listClassesToday(chatId, day, store) {
  return success("CLASSES_TODAY_LISTED", { day, classes: store.getByDay(chatId, day), bellEnabled: store.getBell(chatId) });
}
function addClass(input, store, scheduler) {
  const valid = validateUpdates(input, true);
  if (!valid.ok) return valid;
  const classData = store.add(input.chatId, valid.data);
  reschedule(scheduler, input.chatId);
  return success("CLASS_CREATED", { classData, ...listData(input.chatId, store) });
}
function updateClass({ chatId, reference, updates }, store, scheduler) {
  const resolved = resolveClass(chatId, reference, store);
  if (!resolved.ok) return resolved;
  const valid = validateUpdates(updates);
  if (!valid.ok) return valid;
  const classData = store.update(chatId, resolved.data.classData.id, valid.data);
  reschedule(scheduler, chatId);
  return success("CLASS_UPDATED", { classData, ...listData(chatId, store) });
}
function deleteClass({ chatId, index, reference = index }, store, scheduler) {
  const resolved = resolveClass(chatId, reference, store);
  if (!resolved.ok) return resolved;
  const classData = store.remove(chatId, resolved.data.classData.id);
  reschedule(scheduler, chatId);
  return success("CLASS_DELETED", { classData, ...listData(chatId, store) });
}
function setBell({ chatId, enabled }, store, scheduler) {
  if (typeof enabled !== "boolean") return failure("CLASS_BELL_INVALID");
  const value = store.setBell(chatId, enabled);
  reschedule(scheduler, chatId);
  return success("CLASS_BELL_SET", { enabled: value, ...listData(chatId, store) });
}
function toggleBell({ chatId }, store, scheduler) {
  const enabled = store.toggleBell(chatId);
  reschedule(scheduler, chatId);
  return success("CLASS_BELL_TOGGLED", { enabled, ...listData(chatId, store) });
}
function resolveClass(chatId, reference, store) {
  if (reference === undefined || reference === null || String(reference).trim() === "") return failure("CLASS_REFERENCE_INVALID");
  const resolved = store.resolve(chatId, String(reference));
  if (resolved.ambiguous) return failure("CLASS_AMBIGUOUS", { matches: resolved.matches });
  return resolved.class ? success("CLASS_RESOLVED", { classData: resolved.class }) : failure("CLASS_NOT_FOUND");
}
function validateUpdates(input, requireAll = false) {
  const data = {},
    fields = ["name", "day", "timeRange", "startTime", "endTime", "classroom"];
  if (!requireAll && !fields.some((field) => input[field] !== undefined)) return failure("CLASS_UPDATE_EMPTY");
  if (input.name !== undefined) {
    const value = typeof input.name === "string" ? input.name.trim() : "";
    if (!value) return failure("CLASS_NAME_INVALID");
    data.name = value;
  }
  if (input.day !== undefined) {
    const value = typeof input.day === "string" ? input.day.trim().toLowerCase() : "";
    if (!DAYS_ORDER.includes(value)) return failure("CLASS_DAY_INVALID");
    data.day = value;
  }
  if (input.classroom !== undefined) {
    const value = typeof input.classroom === "string" ? input.classroom.trim() : "";
    if (!value) return failure("CLASS_CLASSROOM_INVALID");
    data.classroom = value;
  }
  if (input.timeRange !== undefined) {
    const value = typeof input.timeRange === "string" ? parseTimeRange(input.timeRange.trim()) : undefined;
    if (!value) return failure("CLASS_TIME_INVALID");
    Object.assign(data, value);
  }
  if (input.startTime !== undefined || input.endTime !== undefined) {
    const value = parseTimeRange(`${input.startTime}-${input.endTime}`);
    if (!value) return failure("CLASS_TIME_INVALID");
    Object.assign(data, value);
  }
  if (requireAll && (!data.name || !data.day || !data.classroom || !data.startTime)) return failure("CLASS_INVALID");
  return success("CLASS_INPUT_VALID", data);
}
function listData(chatId, store) {
  return { classes: store.getAllSorted(chatId), bellEnabled: store.getBell(chatId) };
}
function reschedule(scheduler, chatId) {
  scheduler?.rescheduleForChat(chatId);
}
module.exports = { addClass, deleteClass, listClasses, listClassesToday, resolveClass, setBell, toggleBell, updateClass, validateUpdates };
