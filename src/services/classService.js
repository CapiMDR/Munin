const { DAYS_ORDER, getMexicoCityTime, parseTimeRange, timeToMinutes } = require("../utils/timeUtils");
const { failure, success } = require("./result");

function listClasses(chatId, store) {
  return success("CLASSES_LISTED", listData(chatId, store));
}
function listClassesToday(chatId, day = getMexicoCityTime().day, store) {
  return success("CLASSES_TODAY_LISTED", { day, classes: store.getByDay(chatId, day), bellEnabled: store.getBell(chatId) });
}

function getCurrentClass(chatId, store, now = getMexicoCityTime()) {
  const today = store.getByDay(chatId, now.day);
  const active = today.find((classData) => now.minutes >= timeToMinutes(classData.startTime) && now.minutes < timeToMinutes(classData.endTime));
  if (active) return success("CLASS_CURRENT_ACTIVE", { classData: active });

  const nextToday = today.find((classData) => timeToMinutes(classData.startTime) > now.minutes);
  if (nextToday) return success("CLASS_CURRENT_NEXT", { classData: nextToday, day: nextToday.day });

  const classes = store.getAllSorted(chatId);
  if (!classes.length) return success("CLASSES_EMPTY");
  for (let offset = 1; offset <= DAYS_ORDER.length; offset += 1) {
    const nextDay = DAYS_ORDER[(DAYS_ORDER.indexOf(now.day) + offset) % DAYS_ORDER.length];
    const next = classes.find((classData) => classData.day === nextDay);
    if (next) return success("CLASS_CURRENT_NEXT", { classData: next, day: next.day });
  }

  return success("CLASSES_EMPTY");
}
function addClass(input, store, scheduler) {
  const valid = validateUpdates(input, true);
  if (!valid.ok) return valid;
  const classData = store.add(input.chatId, valid.data);
  reschedule(scheduler, input.chatId);
  return success("CLASS_CREATED", { classData, ...listData(input.chatId, store) });
}

function addClassFromCommand({ chatId, args }, store, scheduler) {
  const parts = args
    .join(" ")
    .split(",")
    .map((item) => item.trim());
  if (parts.length !== 4 || parts.some((item) => !item)) return failure("CLASS_ADD_INPUT_INVALID");

  const [name, day, timeRange, classroom] = parts;
  return addClass({ chatId, name, day, timeRange, classroom }, store, scheduler);
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

function parseClassUpdates(input) {
  if (typeof input !== "string" || !input.trim()) return failure("CLASS_EDIT_INPUT_INVALID");

  const updates = {};
  const items = input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!items.length) return failure("CLASS_EDIT_INPUT_INVALID");

  for (const item of items) {
    const separatorIndex = item.indexOf("=");
    if (separatorIndex === -1) return failure("CLASS_EDIT_INPUT_INVALID");

    const field = item.slice(0, separatorIndex).trim().toLowerCase();
    const value = item.slice(separatorIndex + 1).trim();
    if (!value) return failure("CLASS_EDIT_INPUT_INVALID");

    if (field === "nombre") updates.name = value;
    else if (field === "día" || field === "dia") updates.day = value;
    else if (field === "horario") updates.timeRange = value;
    else if (field === "salón" || field === "salon") updates.classroom = value;
    else return failure("CLASS_EDIT_FIELD_UNKNOWN", { field });
  }

  const valid = validateUpdates(updates);
  return valid.ok ? success("CLASS_UPDATES_PARSED", { updates: valid.data }) : valid;
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
module.exports = {
  addClass,
  addClassFromCommand,
  deleteClass,
  getCurrentClass,
  listClasses,
  listClassesToday,
  parseClassUpdates,
  resolveClass,
  setBell,
  toggleBell,
  updateClass,
  validateUpdates,
};
