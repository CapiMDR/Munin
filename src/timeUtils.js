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
  return `${reminder.content} (vence ${formatMexicoCityDateTime(reminder.dueAt)})`;
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

function millisecondsUntilTime(time, targetMinutes) {
  const currentSeconds = time.minutes * 60 + time.seconds;
  const targetSeconds = targetMinutes * 60;
  const secondsUntil = targetSeconds - currentSeconds;
  return (secondsUntil > 0 ? secondsUntil : secondsUntil + 24 * 60 * 60) * 1_000;
}

function millisecondsUntilNextDay(time) {
  return (24 * 60 * 60 - time.minutes * 60 - time.seconds) * 1_000;
}

module.exports = { formatDuration, formatMexicoCityDateTime, formatReminder, formatRemainingDuration, formatTimerDuration, getMexicoCityDate, getMexicoCityDateKey, getMexicoCityTime, millisecondsUntilNextDay, millisecondsUntilTime, parseDuration, parseTimeRange, parseTimerDuration, timeToMinutes };
