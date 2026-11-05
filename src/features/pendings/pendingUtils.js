const { resolveMexicoCityDate } = require("../../utils/dateUtils");
const { parseClockTime } = require("../../utils/timeUtils");

function parsePendingDate(value) {
  if (typeof value !== "string" || !value.startsWith("@")) return undefined;
  return resolveMexicoCityDate(value.slice(1))?.iso;
}

function formatPending(pending) {
  if (typeof pending === "string") return pending;
  const scheduledFor = pending.date || pending.time ? `${[formatPendingDate(pending.date), pending.time].filter(Boolean).join(" ")} - ` : "";
  return `${scheduledFor}${pending.content}`;
}

function parsePendingTime(value) {
  if (typeof value !== "string") return undefined;
  return parseClockTime(value)?.formatted;
}

function getPendingContent(pending) {
  return typeof pending === "string" ? pending : pending.content;
}

function formatPendingDate(value) {
  const match = typeof value === "string" && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function groupPendingsByDate(pendings, today) {
  const groups = { expired: [], today: [], active: [], noDate: [] };
  const todayValue = calendarDateValue(today);

  sortPendingsByPriority(pendings, today).forEach((pending, index) => {
    const date = typeof pending === "object" ? pending.date : undefined;
    const dateParts = parsePendingDateParts(date, today.year);
    const item = `${index + 1}. ${formatPending(pending)}`;

    if (!dateParts) {
      groups.noDate.push(item);
      return;
    }

    const dateValue = calendarDateValue(dateParts);
    if (dateValue < todayValue) groups.expired.push(item);
    else if (dateValue === todayValue) groups.today.push(item);
    else groups.active.push(item);
  });

  return groups;
}

function sortPendingsByPriority(pendings, today) {
  const todayValue = calendarDateValue(today);
  const priority = (pending) => {
    const dateParts = typeof pending === "object" ? parsePendingDateParts(pending.date, today.year) : undefined;
    if (!dateParts) return { group: 3, distance: Infinity, time: Infinity };
    const dateValue = calendarDateValue(dateParts);
    const time = typeof pending === "object" && pending.time ? Number(pending.time.replace(":", "")) : Infinity;
    if (dateValue < todayValue) return { group: 0, distance: dateValue, time };
    if (dateValue === todayValue) return { group: 1, distance: 0, time };
    return { group: 2, distance: dateValue - todayValue, time };
  };

  return pendings.sort((left, right) => {
    const leftPriority = priority(left);
    const rightPriority = priority(right);
    return (
      leftPriority.group - rightPriority.group ||
      leftPriority.distance - rightPriority.distance ||
      leftPriority.time - rightPriority.time
    );
  });
}

function parsePendingDateParts(value, fallbackYear) {
  const iso = typeof value === "string" && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  const legacy = typeof value === "string" && value.match(/^(\d{2})\/(\d{2})$/);
  return legacy ? { year: fallbackYear, month: Number(legacy[2]), day: Number(legacy[1]) } : undefined;
}

function calendarDateValue({ year, month, day }) {
  return Date.UTC(year, month - 1, day);
}

module.exports = { formatPending, formatPendingDate, getPendingContent, groupPendingsByDate, parsePendingDate, parsePendingTime, sortPendingsByPriority };
