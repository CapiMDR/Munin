function parsePendingDate(value) {
  const match = value?.match(/^@(\d{2})\/(\d{2})$/);
  if (!match) return undefined;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const date = new Date(2024, month - 1, day);

  return date.getMonth() === month - 1 && date.getDate() === day ? `${match[1]}/${match[2]}` : undefined;
}

function formatPending(pending) {
  if (typeof pending === "string") return pending;
  return `${pending.date ? `${pending.date} - ` : ""}${pending.content}`;
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

module.exports = { formatPending, getPendingContent, groupPendingsByDate, parsePendingDate };
