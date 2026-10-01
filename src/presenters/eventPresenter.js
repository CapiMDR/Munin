const { formatMexicoCityDateTime, formatRemainingDuration } = require("../utils/timeUtils");

const RSVP_LABELS = { going: "voy", maybe: "tal vez", declined: "no voy" };
const WEEKDAY_LABELS = {
  monday: "lunes",
  tuesday: "martes",
  wednesday: "miércoles",
  thursday: "jueves",
  friday: "viernes",
  saturday: "sábado",
  sunday: "domingo",
};

function presentEventResult(result) {
  if (!result.ok) return { ok: false, code: result.code, message: getErrorMessage(result.code) };
  const { event } = result.data;
  switch (result.code) {
    case "EVENT_CREATED":
      return { ok: true, action: "create_event", message: `📅 Evento creado\n${formatEvent(event)}` };
    case "EVENT_UPDATED":
      return { ok: true, action: "update_event", message: `📅 Evento actualizado\n${formatEvent(event)}` };
    case "EVENT_DELETED":
      return { ok: true, action: "delete_event", message: `📅 Evento eliminado: ${event.title} (${event.id})` };
    case "EVENT_FOUND":
      return { ok: true, action: "get_event", message: formatEvent(event, true) };
    case "EVENTS_LISTED":
      return { ok: true, action: "list_events", message: formatEvents(result.data.events) };
    case "EVENT_RSVP_UPDATED":
      return { ok: true, action: "rsvp_event", message: `📅 Tu respuesta para “${event.title}” quedó como: ${RSVP_LABELS[result.data.status]}.` };
    case "EVENT_COUNTDOWN_FOUND":
      return {
        ok: true,
        action: "get_event_countdown",
        message: `📅 Faltan ${formatRemainingDuration(result.data.occurrenceAt - Date.now())} para ${event.title}.\n${formatEventStartAt(toEventStartAt(event, result.data.occurrenceAt))}`,
      };
    default:
      return { ok: false, code: "EVENT_RESULT_UNKNOWN", message: "No pude procesar ese evento." };
  }
}

function formatEvents(events) {
  if (!events.length) return "📅 No hay eventos guardados para este grupo.";
  return `📅 Eventos del grupo:\n${events.map((event) => `${event.id} — ${event.title}\n${formatEventStartAt(event.startAt)}\n${formatEventMetadata(event)}`).join("\n\n")}`;
}

function formatEvent(event, detailed = false) {
  const lines = [`${event.title}`, `ID: ${event.id}`, `Fecha: ${formatEventStartAt(event.startAt)}`];
  lines.push(formatEventMetadata(event));
  if (event.description) lines.push(event.description);
  const location = [event.location?.name, event.location?.place].filter(Boolean).join(" · ");
  if (location) lines.push(`Lugar: ${location}`);
  if (event.location?.url) lines.push(event.location.url);
  if (event.recurrence) lines.push(`Se repite: ${formatRecurrence(event.recurrence)}`);
  if (event.reminders?.length) lines.push(`Recordatorios: ${event.reminders.length}`);
  if (detailed) lines.push(formatParticipants(event.participants));
  return lines.join("\n");
}

function formatEventMetadata(event) {
  return `Tipo: ${formatEventType(event.type)}\nOrganiza: ${getOrganizerName(event)}`;
}

function formatEventType(type) {
  return {
    social: "social",
    birthday: "cumpleaños",
    anniversary: "aniversario",
    holiday: "festividad",
    meeting: "reunión",
  }[type] || type;
}

function getOrganizerName(event) {
  return event.createdByName && event.createdByName !== event.createdBy ? event.createdByName : "Sin nombre disponible";
}

function presentEventReminder(event) {
  return `📅 Recordatorio de evento: ${event.title}\n${formatEventStartAt(event.startAt)}`;
}

function formatParticipants(participants = {}) {
  const groups = [
    ["Van", participants.going || []],
    ["Tal vez", participants.maybe || []],
    ["No van", participants.declined || []],
  ];
  return `Asistencia:\n${groups
    .map(([label, members]) => {
      const names = members.map(getParticipantName).filter(Boolean);
      return `${label} (${names.length}): ${names.length ? names.join(", ") : "—"}`;
    })
    .join("\n")}`;
}

function getParticipantName(participant) {
  return typeof participant === "object" ? participant.name || null : null;
}

function formatRecurrence(recurrence) {
  const frequency = { day: "día", week: "semana", month: "mes", year: "año" }[recurrence.frequency] || recurrence.frequency;
  const cadence =
    recurrence.interval === 1 ? `cada ${frequency}` : `cada ${recurrence.interval} ${pluralizeFrequency(recurrence.frequency, frequency)}`;
  const days = recurrence.daysOfWeek?.length ? ` (${recurrence.daysOfWeek.map((day) => WEEKDAY_LABELS[day]).join(", ")})` : "";
  const limit = recurrence.until
    ? ` hasta ${formatEventStartAt(recurrence.until)}`
    : recurrence.count === null
      ? " para siempre"
      : ` por ${recurrence.count} veces`;
  return `${cadence}${days}${limit}`;
}

function formatEventStartAt(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatMexicoCityDateTime(value);
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function pluralizeFrequency(key, label) {
  return { day: "días", week: "semanas", month: "meses", year: "años" }[key] || `${label}s`;
}

function getErrorMessage(code) {
  const errors = {
    EVENT_NOT_FOUND: "No encontré un evento con ese ID en este grupo.",
    EVENT_UPDATE_REQUIRED: "Indica qué dato del evento quieres cambiar.",
    EVENT_RSVP_INVALID: "No entendí tu respuesta al evento. Usa voy, tal vez o no voy.",
    EVENT_LOCATION_INVALID: "La ubicación del evento no es válida.",
    EVENT_RECURRENCE_UNTIL_INVALID: "La fecha final de repetición no puede ser anterior al inicio.",
    EVENT_RECURRENCE_COUNT_INVALID: "La cantidad de repeticiones debe ser un número entero positivo.",
    EVENT_RECURRENCE_INVALID: "La repetición del evento no es válida.",
    EVENT_ALREADY_PASSED: "Ese evento ya pasó y no tiene una próxima ocurrencia.",
  };
  return errors[code] || "No pude crear o modificar ese evento. Asegúrate de incluir un título y una fecha con hora válida.";
}

function toEventStartAt(event, occurrenceAt) {
  return /^\d{4}-\d{2}-\d{2}$/.test(event.startAt) ? new Date(occurrenceAt).toISOString() : occurrenceAt;
}

module.exports = { presentEventReminder, presentEventResult };
