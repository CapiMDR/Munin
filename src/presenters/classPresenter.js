const { MESSAGES } = require("../commandConstants");
const { formatAllClasses, formatClassesToday } = require("../listResponseFormatter");
const { DAYS_ORDER, getDays } = require("../utils/timeUtils");

function presentClassResult(result) {
  if (!result.ok) return presentFailure(result);

  const { classData, classes, bellEnabled, day, enabled } = result.data;
  switch (result.code) {
    case "CLASSES_LISTED":
      return { ok: true, action: "list_classes", message: formatAllClasses(classes, undefined, bellEnabled) };
    case "CLASSES_TODAY_LISTED":
      return { ok: true, action: "list_classes_today", message: formatClassesToday(day, classes, undefined, bellEnabled) };
    case "CLASS_CREATED":
      return mutation("add_class", MESSAGES.CLASS_ADDED(classData, dayName(classData.day)), classes, bellEnabled);
    case "CLASS_UPDATED":
      return mutation("edit_class", MESSAGES.CLASS_EDITED(classData, dayName(classData.day)), classes, bellEnabled);
    case "CLASS_DELETED":
      return mutation("delete_class", MESSAGES.CLASS_DELETED(classData.name), classes, bellEnabled);
    case "CLASS_BELL_SET":
    case "CLASS_BELL_TOGGLED":
      return {
        ok: true,
        action: "set_class_bell",
        message: MESSAGES.MUTATION_WITH_LIST(enabled ? MESSAGES.BELL_ON : MESSAGES.BELL_OFF, formatAllClasses(classes, undefined, bellEnabled)),
      };
    default:
      return { ok: false, code: "CLASS_RESULT_UNKNOWN", message: MESSAGES.ADD_CLASS_USAGE };
  }
}

function mutation(action, confirmation, classes, bellEnabled) {
  return { ok: true, action, message: MESSAGES.MUTATION_WITH_LIST(confirmation, formatAllClasses(classes, undefined, bellEnabled)) };
}

function presentFailure(result) {
  if (result.code === "CLASS_AMBIGUOUS")
    return { ok: false, code: result.code, message: MESSAGES.CLASS_AMBIGUOUS(result.data.matches.map(formatMatch)) };
  if (["CLASS_NOT_FOUND", "CLASS_REFERENCE_INVALID"].includes(result.code))
    return { ok: false, code: result.code, message: MESSAGES.CLASS_NOT_FOUND };
  if (result.code === "CLASS_DAY_INVALID") return { ok: false, code: result.code, message: MESSAGES.INVALID_DAY };
  if (result.code === "CLASS_TIME_INVALID") return { ok: false, code: result.code, message: MESSAGES.INVALID_TIME };
  return { ok: false, code: result.code, message: MESSAGES.ADD_CLASS_USAGE };
}

function formatMatch(cls) {
  return `  ${cls.globalIndex}. ${cls.name} — ${cls.startTime} - ${cls.endTime} — ${cls.classroom}`;
}
function dayName(day) {
  return getDays()[DAYS_ORDER.indexOf(day)];
}

module.exports = { presentClassResult };
