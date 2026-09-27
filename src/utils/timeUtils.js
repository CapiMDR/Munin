const DAYS_ORDER = Object.freeze([
  "lunes",
  "martes",
  "mi\u00e9rcoles",
  "jueves",
  "viernes",
  "s\u00e1bado",
  "domingo"
]);
const DAYS = Object.freeze(DAYS_ORDER.map((day) => day.charAt(0).toUpperCase() + day.slice(1)));

function getDays() {
  return DAYS;
}

// Parses a duration string like "5m", "2h", or "1d" into milliseconds.
function parseDuration(value) {
  const match = value?.match(/^(\d+)([mhd])$/i);

  if (!match) return undefined;

  const amount = Number(match[1]);
  const units = { m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount > 0 ? amount * units[match[2].toLowerCase()] : undefined;
}

function parseTimerDuration(value) {
  const match = value?.match(/^(\d+)([smh])$/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const units = { s: 1_000, m: 60_000, h: 3_600_000 };
  return amount > 0 ? amount * units[match[2].toLowerCase()] : undefined;
}

function formatTimerDuration(value) {
  const [, amount, unit] = value.match(/^(\d+)([smh])$/i);
  const names = { s: amount === "1" ? "segundo" : "segundos", m: amount === "1" ? "minuto" : "minutos", h: amount === "1" ? "hora" : "horas" };
  return `${amount} ${names[unit.toLowerCase()]}`;
}

function formatDuration(value) {
  const [, amount, unit] = value.match(/^(\d+)([mhd])$/i);
  const names = {
    m: amount === "1" ? "minuto" : "minutos",
    h: amount === "1" ? "hora" : "horas",
    d: amount === "1" ? "día" : "días",
  };
  return `${amount} ${names[unit.toLowerCase()]}`;
}

function formatReminder(reminder) {
  const next = formatMexicoCityDateTime(reminder.nextTriggerAt);
  if (!reminder.recurrence) return `${reminder.text} (vence ${next})`;
  if (reminder.recurrence.frequency !== "week") {
    const count = reminder.recurrence.count;
    const limit = count === null ? " para siempre" : count ? ` por ${count} veces` : "";
    return `${reminder.text} (próxima ${next}${limit})`;
  }

  const { interval, daysOfWeek, time, until, count } = reminder.recurrence;
  const cadence = interval === 1 ? "cada semana" : `cada ${interval} semanas`;
  const limit = until ? ` hasta ${formatMexicoCityDateTime(until)}` : count === null ? " para siempre" : count ? ` por ${count} veces` : "";
  const weekdays = daysOfWeek.map(formatWeekday).join(", ");
  return `${reminder.text} (${cadence}: ${weekdays} a las ${time} >  próxima ${next}${limit})`;
}

function formatWeekday(day) {
  return (
    {
      monday: "lunes",
      tuesday: "martes",
      wednesday: "miércoles",
      thursday: "jueves",
      friday: "viernes",
      saturday: "sábado",
      sunday: "domingo",
    }[day] || day
  );
}

function formatMexicoCityDateTime(value) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "short",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(new Date(value));
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Parses a time range string like "8:00-9:30" into { startTime, endTime }.
function parseTimeRange(value) {
  const match = value?.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
  if (!match) return undefined;

  const startTime = normalizeTime(match[1]);
  const endTime = normalizeTime(match[2]);
  return isValidTime(startTime) && isValidTime(endTime) && startTime < endTime ? { startTime, endTime } : undefined;
}
// Normalizes a time string to "HH:mm" format.
function normalizeTime(time) {
  const [hours, minutes] = time.split(":");
  return `${hours.padStart(2, "0")}:${minutes}`;
}

function isValidTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function getMexicoCityTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const dayNames = {
    Monday: "lunes",
    Tuesday: "martes",
    Wednesday: "miércoles",
    Thursday: "jueves",
    Friday: "viernes",
    Saturday: "sábado",
    Sunday: "domingo",
  };

  return {
    day: dayNames[values.weekday],
    minutes: Number(values.hour) * 60 + Number(values.minute),
    seconds: Number(values.second),
  };
}

function formatRemainingDuration(milliseconds) {
  const totalSeconds = Math.max(1, Math.ceil(milliseconds / 1_000));
  const units = [
    [86_400, "día", "días"],
    [3_600, "hora", "horas"],
    [60, "minuto", "minutos"],
    [1, "segundo", "segundos"],
  ];
  const [unitSeconds, singular, plural] = units.find(([seconds]) => totalSeconds >= seconds);
  const amount = Math.floor(totalSeconds / unitSeconds);
  return `${amount} ${amount === 1 ? singular : plural}`;
}

function getMexicoCityDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));

  return { day: Number(values.day), month: Number(values.month) };
}

function getMexicoCityDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));

  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

function parseClockTime(value) {
  const match = value?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  return { hour, minute, formatted: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
}

// Converts a Mexico City wall-clock date/time into an absolute timestamp while
// respecting the timezone's IANA rules instead of the host machine timezone.
function mexicoCityDateTimeToTimestamp({ year, month, day, hour, minute }) {
  const desiredLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let timestamp = desiredLocalAsUtc;

  for (let attempt = 0; attempt < 3; attempt++) {
    const local = getMexicoCityDateTimeParts(new Date(timestamp));
    const actualLocalAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    timestamp += desiredLocalAsUtc - actualLocalAsUtc;
  }

  return timestamp;
}

function getMexicoCityDateTimeParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function getMexicoCityDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function getMexicoCityWeekKey(date = new Date()) {
  const { year, month, day } = getMexicoCityDateParts(date);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const isoWeekday = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - isoWeekday);

  const weekYear = utcDate.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstIsoWeekday = firstThursday.getUTCDay() || 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 4 - firstIsoWeekday);
  const week = 1 + Math.round((utcDate - firstThursday) / 604_800_000);

  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

function millisecondsUntilTime(time, targetMinutes) {
  const currentSeconds = time.minutes * 60 + time.seconds;
  const targetSeconds = targetMinutes * 60;
  const secondsUntil = targetSeconds - currentSeconds;
  return (secondsUntil > 0 ? secondsUntil : secondsUntil + 24 * 60 * 60) * 1_000;
}

function millisecondsUntilNextDay(time) {
  return (24 * 60 * 60 - time.minutes * 60 - time.seconds) * 1_000;
}

module.exports = {
  DAYS_ORDER,
  formatDuration,
  formatMexicoCityDateTime,
  formatReminder,
  formatRemainingDuration,
  formatTimerDuration,
  getMexicoCityDate,
  getMexicoCityDateKey,
  getMexicoCityDateParts,
  getMexicoCityTime,
  getMexicoCityWeekKey,
  getDays,
  mexicoCityDateTimeToTimestamp,
  millisecondsUntilNextDay,
  millisecondsUntilTime,
  parseClockTime,
  parseDuration,
  parseTimeRange,
  parseTimerDuration,
  timeToMinutes,
};

