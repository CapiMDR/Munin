const { COMMANDS } = require("../../config/commandConstants");
const { getPendingContent, groupPendingsByDate } = require("./pendingUtils");
const { getMexicoCityDate } = require("../../utils/timeUtils");

function presentPendingResult(result) {
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.code === "PENDING_NOT_FOUND" ? "No existe un pendiente con ese índice en este chat." : pendingUsage(),
    };
  }

  const { pending, pendings } = result.data;
  if (result.code === "PENDINGS_LISTED") return { ok: true, action: "list_pendings", message: formatPendings(pendings) };
  if (result.code === "PENDING_CREATED") {
    return {
      ok: true,
      action: "create_pending",
      message: mutationWithList(
        `Pendiente agregado${pending.date ? ` para ${pending.date}` : ""}${pending.time ? ` a las ${pending.time}` : ""}: ${pending.content}`,
        formatPendings(pendings),
      ),
    };
  }
  if (result.code === "PENDING_DELETED") {
    return {
      ok: true,
      action: "delete_pending",
      message: mutationWithList(`Pendiente ${result.data.index} eliminado: ${getPendingContent(pending)}`, formatPendings(pendings)),
    };
  }
  if (result.code === "PENDINGS_DELETED") {
    return {
      ok: true,
      action: "delete_pendings",
      message: mutationWithList(formatBulkDeletion("pendientes", result.data.deleted.length, result.data.invalidIndexes), formatPendings(pendings)),
    };
  }
  if (result.code === "PENDING_UPDATED") {
    return {
      ok: true,
      action: "edit_pending",
      message: mutationWithList(`Pendiente ${result.data.index} actualizado: ${getPendingContent(pending)}`, formatPendings(pendings)),
    };
  }
  return { ok: false, code: "PENDING_RESULT_UNKNOWN", message: pendingUsage() };
}

function formatPendings(pendings) {
  return pendings.length ? formatDailyPendings(groupPendingsByDate(pendings, getMexicoCityDate())) : "No hay pendientes guardados para este chat.";
}

function pendingUsage() {
  return `Uso: ${COMMANDS.PENDING} [@<dd/mm>] [HH:mm] <pendiente>, responde a un mensaje con ${COMMANDS.PENDING}, o usa ${COMMANDS.PENDING} - <índice> para eliminarlo`;
}
function mutationWithList(confirmation, list) {
  return `${confirmation}\n\n${list}`;
}
function formatBulkDeletion(noun, count, invalidIndexes) {
  const confirmation = count ? `Se eliminaron ${count} ${noun}.` : "No encontré pendientes para eliminar.";
  return invalidIndexes.length ? `${confirmation}\nNo encontré los índices: ${invalidIndexes.join(", ")}.` : confirmation;
}
function formatDailyPendings(groups) {
  return [
    "🐦‍⬛ Esto es lo que se tiene pendiente:",
    groups.expired.length && `Ya se te pasaron:\n${groups.expired.join("\n")}`,
    groups.today.length && `Para hoy, no se te olviden:\n${groups.today.join("\n")}`,
    groups.active.length && `Todavía hay tiempo:\n${groups.active.join("\n")}`,
    groups.noDate.length && `Estos andan sin rumbo ni fecha:\n${groups.noDate.join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

module.exports = { formatDailyPendings, formatPendings, presentPendingResult };
