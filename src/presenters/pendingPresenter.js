const { MESSAGES } = require("../commandConstants");
const { formatPendings } = require("../listResponseFormatter");
const { getPendingContent } = require("../utils/pendingUtils");

function presentPendingResult(result, { index } = {}) {
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
      message: MESSAGES.MUTATION_WITH_LIST(MESSAGES.PENDING_DELETED(index, getPendingContent(pending)), formatPendings(pendings)),
    };
  }
  return { ok: false, code: "PENDING_RESULT_UNKNOWN", message: MESSAGES.PENDING_USAGE };
}

module.exports = { presentPendingResult };
