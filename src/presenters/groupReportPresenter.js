const { getWeeklyReportComment, getWeeklyStatLeaders } = require("../services/groupReportService");

function presentGroupReport(stats) {
  const leaders = getWeeklyStatLeaders(stats.members);
  return [
    "🐦‍⬛ Ha llegado el momento de desvelar el reporte que le daré a Odín",
    "",
    "*Lo que observé hoy*",
    `${stats.daily.messages} mensajes · ${stats.daily.words} palabras`,
    `${stats.daily.repliesSent} respuestas · ${stats.daily.mentionsSent} menciones`,
    `${stats.daily.stickers} stickers · ${stats.daily.images} imágenes · ${stats.daily.voiceNotes} audios · ${stats.daily.feathers} plumas`,
    "",
    "*Lo que observé esta semana*",
    `${stats.weekly.messages} mensajes · ${stats.weekly.words} palabras`,
    `${stats.weekly.stickers} stickers · ${stats.weekly.images} imágenes · ${stats.weekly.voiceNotes} audios · ${stats.weekly.feathers} plumas`,
    "",
    "*Trabajo para el cuervo*",
    `${stats.weekly.commandsUsed} comandos · ${stats.weekly.remindersCreated} recordatorios`,
    `${stats.weekly.messagesSaved} mensajes guardados · ${stats.weekly.pollsCreated} encuestas`,
    "\nAhora sí, lo verdaderamente importante.",
    "*Los títulos de esta semana son:*",
    formatGroupLeader(
      leaders.messages,
      "El más ruidoso",
      "mensajes",
      "El grupo guarda un silencio sospechoso.",
      "El cuervo no puede elegir entre tanto ruido",
    ),
    "",
    formatGroupLeader(
      leaders.repliesSent,
      "El contestón",
      "respuestas",
      "Nadie ha respondido a un mensaje todavía.",
      "El cuervo declara un empate de réplicas",
    ),
    "",
    formatGroupLeader(
      leaders.mentionsReceived,
      "El favorito",
      "menciones recibidas",
      "Nadie ha sido mencionado todavía.",
      "El cuervo ve popularidad compartida",
    ),
    "",
    formatGroupLeader(
      leaders.muninMentions,
      "El invocador",
      "menciones a Munin",
      "Nadie me ha convocado aún.",
      "El cuervo escucha un llamado compartido",
    ),
    "",
    formatGroupLeader(
      leaders.stickers,
      "El que usa demasiados stickers",
      "stickers",
      "Nadie ha usado stickers todavía.",
      "El cuervo detecta una ciencia de stickers compartida",
    ),
    "",
    formatGroupLeader(leaders.images, "El fotógrafo", "imágenes", "Nadie ha compartido imágenes todavía.", "El cuervo ve una galería compartida"),
    "",
    formatGroupLeader(
      leaders.nightMessages,
      "El búho nocturno",
      "mensajes nocturnos",
      "Nadie ha desvelado al cuervo todavía.",
      "El cuervo detecta una vigilia compartida",
    ),
    "",
    formatGroupLeader(
      leaders.feathers,
      "El favorito del cuervo",
      "plumas",
      "El cuervo no ha entregado plumas todavía.",
      "El cuervo reparte sus plumas por igual",
    ),
    "",
    formatTriviaLeader(leaders.trivia.gamesWon, "El tryhard", "Nadie ha ganado una trivia todavía.", "El cuervo declara una victoria compartida"),
    "",
    formatTriviaLeader(
      leaders.trivia.correctAnswers,
      "El sabelotodo",
      "Nadie ha acertado una respuesta todavía.",
      "El cuervo ve un empate de sabios",
    ),
    "",
    formatLowestTriviaCorrectAnswers(stats.members, "Al que le falta estudiar"),
    "",
    "🪶 *Ya terminando:*",
    getWeeklyReportComment(stats.weekly, leaders, stats.currentPendings || 0),
  ].join("\n");
}

function formatGroupLeader(leader, title, unit, zeroMessage, tieMessage) {
  if (leader.value === 0) return `${title}\n> ${zeroMessage}`;

  const displayUnit = leader.value === 1 ? singularGroupUnit(unit) : unit;
  if (leader.names.length === 1) return `${title}\n> ${leader.names[0]} — ${leader.value} ${displayUnit}`;
  return `${title}\n> ${tieMessage}: ${leader.names.join(", ")} — ${leader.value} ${displayUnit}`;
}

function formatTriviaLeader(leader, title, zeroMessage, tieMessage) {
  if (leader.value === 0) return `${title}\n> ${zeroMessage}`;
  if (leader.names.length === 1) return `${title}\n> ${leader.names[0]} — ${leader.value}`;
  return `${title}\n> ${tieMessage}: ${leader.names.join(", ")} — ${leader.value}`;
}

function formatLowestTriviaCorrectAnswers(members, title) {
  const players = members.filter((member) => (member.weekly?.trivia?.gamesPlayed || 0) > 0);
  if (!players.length) return `${title}\n> Nadie ha participado en una trivia todavía.`;

  const lowest = Math.min(...players.map((member) => member.weekly.trivia.correctAnswers || 0));
  const leaders = players.filter((member) => (member.weekly.trivia.correctAnswers || 0) === lowest).map((member) => member.name);
  const unit = lowest === 1 ? "respuesta correcta" : "respuestas correctas";
  if (leaders.length === 1) return `${title}\n> ${leaders[0]} — ${lowest} ${unit}`;
  return `${title}\n> El cuervo encuentra un empate: ${leaders.join(", ")} — ${lowest} ${unit}`;
}

function singularGroupUnit(unit) {
  return (
    {
      mensajes: "mensaje",
      respuestas: "respuesta",
      "menciones recibidas": "mención recibida",
      "menciones a Munin": "mención a Munin",
      stickers: "sticker",
      imágenes: "imagen",
      plumas: "pluma",
      "mensajes nocturnos": "mensaje nocturno",
    }[unit] || unit
  );
}

module.exports = { presentGroupReport };
