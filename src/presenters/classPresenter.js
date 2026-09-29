const { COMMANDS } = require("../config/commandConstants");
const { DAYS_ORDER, getDays, getMexicoCityTime, timeToMinutes } = require("../utils/timeUtils");

const MESSAGES = {
  MUTATION_WITH_LIST: (confirmation, list) => `${confirmation}\n\n${list}`,
  CURRENT_CLASS_ACTIVE: (cls) => `📚 Ahora: ${cls.name} (${cls.startTime} - ${cls.endTime}) en ${cls.classroom}`,
  CURRENT_CLASS_NEXT: (cls, day) => `📚 Siguiente: ${cls.name} — ${day} ${cls.startTime} - ${cls.endTime} en ${cls.classroom}`,
  NO_CLASSES: "No hay clases registradas.",
  NO_CLASSES_TODAY: "No hay clases hoy.",
  CLASSES_TODAY: (day, lines, bellEnabled) =>
    `🐦‍⬛ Estas son las clases de hoy (${day}):\n${bellEnabled ? "🔔 Campana activada" : "🔕 Campana desactivada"}\n\n${lines.join("\n")}`,
  ALL_CLASSES: (groups, bellEnabled) =>
    `🐦‍⬛ Estas son todas las clases:\n${bellEnabled ? "🔔 Campana activada" : "🔕 Campana desactivada"}\n\n${groups.join("\n\n")}`,
  ADD_CLASS_USAGE: `Uso: ${COMMANDS.ADD_CLASS} <nombre>, <día>, <inicio>-<fin>, <salón>\nEjemplo: ${COMMANDS.ADD_CLASS} Matemáticas, Lunes, 8:00-9:30, A-301`,
  CLASS_ADDED: (cls, day) => `✅ Clase agregada: ${cls.name} — ${day} ${cls.startTime} - ${cls.endTime} en ${cls.classroom}`,
  CLASS_EDITED: (cls, day) => `✅ Clase editada: ${cls.name} — ${day} ${cls.startTime} - ${cls.endTime} en ${cls.classroom}`,
  CLASS_DELETED: (name) => `🗑️ Clase eliminada: ${name}`,
  INVALID_DAY: "Día inválido. Usa: lunes, martes, miércoles, jueves, viernes, sábado, domingo.",
  INVALID_TIME: "Formato de horario inválido. Usa HH:mm-HH:mm (ej: 8:00-9:30).",
  EDIT_CLASS_USAGE: `Uso: ${COMMANDS.EDIT_CLASS} <nombre o índice>, <campo>=<valor>\nCampos: nombre, día, horario (HH:mm-HH:mm), salón\nEjemplo: ${COMMANDS.EDIT_CLASS} 2, horario=10:00-11:30`,
  EDIT_UNKNOWN_FIELD: (field) => `Campo desconocido: "${field}". Campos válidos: nombre, día, horario, salón.`,
  CLASS_NOT_FOUND: "No se encontró la clase.",
  CLASS_AMBIGUOUS: (lines) => `Hay varias clases con ese nombre. Usa el índice de ${COMMANDS.LIST_ALL_CLASSES}:\n${lines.join("\n")}`,
  BELL_ON: "🔔 Recordatorios de 10 minutos antes de clase activados.",
  BELL_OFF: "🔕 Recordatorios de 10 minutos antes de clase desactivados.",
};

function presentClassReminder(cls) {
  return `🔔 ${cls.name} empieza en 10 minutos (${cls.classroom})`;
}

function presentClassResult(result) {
  if (!result.ok) return presentFailure(result);

  const { classData, classes, bellEnabled, day, enabled } = result.data;
  switch (result.code) {
    case "CLASSES_LISTED":
      return { ok: true, action: "list_classes", message: formatAllClasses(classes, undefined, bellEnabled) };
    case "CLASSES_TODAY_LISTED":
      return { ok: true, action: "list_classes_today", message: formatClassesToday(day, classes, undefined, bellEnabled) };
    case "CLASS_CURRENT_ACTIVE":
      return { ok: true, action: "current_class", message: MESSAGES.CURRENT_CLASS_ACTIVE(classData) };
    case "CLASS_CURRENT_NEXT":
      return { ok: true, action: "current_class", message: MESSAGES.CURRENT_CLASS_NEXT(classData, dayName(day)) };
    case "CLASSES_EMPTY":
      return { ok: true, action: "current_class", message: MESSAGES.NO_CLASSES };
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
  if (result.code === "CLASS_EDIT_FIELD_UNKNOWN") return { ok: false, code: result.code, message: MESSAGES.EDIT_UNKNOWN_FIELD(result.data.field) };
  if (result.code === "CLASS_EDIT_INPUT_INVALID") return { ok: false, code: result.code, message: MESSAGES.EDIT_CLASS_USAGE };
  return { ok: false, code: result.code, message: MESSAGES.ADD_CLASS_USAGE };
}

function formatMatch(cls) {
  return `  ${cls.globalIndex}. ${cls.name} — ${cls.startTime} - ${cls.endTime} — ${cls.classroom}`;
}
function dayName(day) {
  return getDays()[DAYS_ORDER.indexOf(day)];
}

function formatAllClasses(classes, currentTime = getMexicoCityTime(), bellEnabled = true) {
  if (!classes.length) return MESSAGES.NO_CLASSES;

  const groups = DAYS_ORDER.map((day) => [day, classes.filter((cls) => cls.day === day)])
    .filter(([, items]) => items.length)
    .map(([day, items]) => {
      const lines = items.map((cls) => {
        const isActive =
          day === currentTime.day && currentTime.minutes >= timeToMinutes(cls.startTime) && currentTime.minutes < timeToMinutes(cls.endTime);
        return formatClassLine(cls, isActive);
      });
      return `${dayName(day)}:\n${lines.join("\n")}`;
    });
  return MESSAGES.ALL_CLASSES(groups, bellEnabled);
}

function formatClassesToday(day, classes, currentMinutes = getMexicoCityTime().minutes, bellEnabled = true) {
  const lines = classes.map((cls) =>
    formatClassLine(cls, currentMinutes >= timeToMinutes(cls.startTime) && currentMinutes < timeToMinutes(cls.endTime)),
  );
  return classes.length ? MESSAGES.CLASSES_TODAY(dayName(day), lines, bellEnabled) : MESSAGES.NO_CLASSES_TODAY;
}

function formatClassLine(cls, isActive = false) {
  return `${!isActive ? "`" : "*"}${cls.globalIndex}. ${cls.name} — ${cls.startTime} - ${cls.endTime} — ${cls.classroom}${!isActive ? "`" : "*"}`;
}

module.exports = { formatAllClasses, formatClassesToday, presentClassReminder, presentClassResult };
