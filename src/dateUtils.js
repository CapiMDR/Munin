const { getMexicoCityDateParts, getMexicoCityTime } = require("./timeUtils");

const RELATIVE_DAY_OFFSETS = Object.freeze({
  hoy: 0,
  manana: 1,
  "pasado manana": 2,
  ayer: -1,
  anteayer: -2,
  today: 0,
  tomorrow: 1,
  yesterday: -1,
});
const WEEKDAYS = Object.freeze(["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]);

// Resolves Spanish (and legacy English) date words in Munin's Mexico City
// timezone. Its dd/mm representation preserves existing storage formats.
function resolveMexicoCityDate(input, now = new Date()) {
  if (typeof input !== "string" || !input.trim()) return undefined;
  const normalized = normalizeDateText(input);
  const current = getMexicoCityDateParts(now);
  if (Object.hasOwn(RELATIVE_DAY_OFFSETS, normalized)) return addDays(current, RELATIVE_DAY_OFFSETS[normalized]);

  const numeric = normalized.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (numeric) return fromParts(current.year, Number(numeric[2]), Number(numeric[1]));

  const weekday = normalized.match(/^(?:(este|esta|el|proximo|proxima) )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)$/);
  if (!weekday) return undefined;
  const currentWeekday = WEEKDAYS.indexOf(normalizeDateText(getMexicoCityTime(now).day));
  const targetWeekday = WEEKDAYS.indexOf(weekday[2]);
  let offset = (targetWeekday - currentWeekday + 7) % 7;
  if (["proximo", "proxima"].includes(weekday[1]) && offset === 0) offset = 7;
  return addDays(current, offset);
}

function normalizeDateText(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function addDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return fromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function fromParts(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return { year, month, day, ddmm: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`, iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

module.exports = { resolveMexicoCityDate };
