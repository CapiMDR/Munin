const { resolveMexicoCityDate } = require("../../utils/dateUtils");
const { parseClockTime } = require("../../utils/timeUtils");

function parsePendingDate(value) {
  if (typeof value !== "string" || !value.startsWith("@")) return undefined;
  return resolveMexicoCityDate(value.slice(1))?.ddmm;
}

function formatPending(pending) {
  if (typeof pending === "string") return pending;
  const scheduledFor = pending.date || pending.time ? `${[pending.date, pending.time].filter(Boolean).join(" ")} - ` : "";
  return `${scheduledFor}${pending.content}`;
}

function parsePendingTime(value) {
  if (typeof value !== "string") return undefined;
  return parseClockTime(value)?.formatted;
}

function getPendingContent(pending) {
  return typeof pending === "string" ? pending : pending.content;
}

function groupPendingsByDate(pendings, today) {
  const groups = { expired: [], today: [], active: [], noDate: [] };
  const todayValue = today.month * 100 + today.day;

  pendings.forEach((pending, index) => {
    const date = typeof pending === "object" ? pending.date : undefined;
    const dateMatch = date?.match(/^(\d{2})\/(\d{2})$/);
    const item = `${index + 1}. ${formatPending(pending)}`;

    if (!dateMatch) {
      groups.noDate.push(item);
      return;
    }

    const dateValue = Number(dateMatch[2]) * 100 + Number(dateMatch[1]);
    if (dateValue < todayValue) groups.expired.push(item);
    else if (dateValue === todayValue) groups.today.push(item);
    else groups.active.push(item);
  });

  return groups;
}

module.exports = { formatPending, getPendingContent, groupPendingsByDate, parsePendingDate, parsePendingTime };
