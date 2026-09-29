const { MESSAGES } = require("./messages");
const { getPendingContent, groupPendingsByDate } = require("../utils/pendingUtils");
const { getMexicoCityDate } = require("../utils/timeUtils");

function presentPendingResult(result) {
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.code === "PENDING_NOT_FOUND" ? MESSAGES.DELETE_PENDING_NOT_FOUND : MESSAGES.PENDING_USAGE,
    };
  }

  const { pending, pendings } = result.data;
  if (result.code === "PENDINGS_LISTED") return { ok: true, action: "list_pendings", message: formatPendings(pendings) };
  if (result.code === "PENDING_CREATED") {
    return {
      ok: true,
      action: "create_pending",
      message: MESSAGES.MUTATION_WITH_LIST(MESSAGES.PENDING_ADDED(pending.content, pending.date, pending.time), formatPendings(pendings)),
    };
  }
  if (result.code === "PENDING_DELETED") {
    return {
      ok: true,
      action: "delete_pending",
      message: MESSAGES.MUTATION_WITH_LIST(MESSAGES.PENDING_DELETED(result.data.index, getPendingContent(pending)), formatPendings(pendings)),
    };
  }
  return { ok: false, code: "PENDING_RESULT_UNKNOWN", message: MESSAGES.PENDING_USAGE };
}

function formatPendings(pendings) {
  return pendings.length ? MESSAGES.DAILY_PENDINGS(groupPendingsByDate(pendings, getMexicoCityDate())) : MESSAGES.NO_PENDING;
}

module.exports = { formatPendings, presentPendingResult };
