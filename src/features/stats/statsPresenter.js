const { COMMANDS } = require("../../config/commandConstants");

const STATS_USAGE = `Uso: ${COMMANDS.STATS} [@usuario]`;
const STATS_UNAVAILABLE = "No pude encontrar tus estadísticas todavía.";

function presentStatsResult(result) {
  if (!result.ok && result.code === "USER_STATS_MENTIONS_INVALID") {
    return { ok: false, code: result.code, message: STATS_USAGE };
  }
  return result.ok
    ? { ok: true, action: "show_user_stats", message: formatUserStats(result.data.stats) }
    : { ok: false, code: result.code, message: STATS_UNAVAILABLE };
}

function formatUserStats(stats) {
  const lifetimeTrivia = stats.lifetime.trivia || {};
  const weeklyTrivia = stats.weekly.trivia || {};
  const dailyTrivia = stats.daily.trivia || {};
  return `🐦‍⬛ Estadísticas de ${stats.name}:
  \n\n*Total*
  \nMensajes: ${stats.lifetime.messages} · Palabras: ${stats.lifetime.words}
  \nRespuestas: ${stats.lifetime.repliesSent}
  \nMenciones enviadas/recibidas: ${stats.lifetime.mentionsSent}/${stats.lifetime.mentionsReceived}
  \nMenciones a Munin: ${stats.lifetime.muninMentions}
  \nStickers/imágenes/notas de voz: ${stats.lifetime.stickers}/${stats.lifetime.images}/${stats.lifetime.voiceNotes}
  \nPlumas: ${stats.lifetime.feathers}
  \nComandos: ${stats.lifetime.commandsUsed} · Recordatorios: ${stats.lifetime.remindersCreated}
  \nMensajes guardados: ${stats.lifetime.messagesSaved} · Encuestas: ${stats.lifetime.pollsCreated}
  \nTrivia: ${lifetimeTrivia.gamesPlayed || 0} jugadas · ${lifetimeTrivia.gamesWon || 0} ganadas
  \nRespuestas correctas: ${lifetimeTrivia.correctAnswers || 0}/${lifetimeTrivia.questionsAnswered || 0}
  
  \n\n*Esta semana*
  \nMensajes: ${stats.weekly.messages} · Palabras: ${stats.weekly.words}
  \nRespuestas: ${stats.weekly.repliesSent}
  \nMenciones enviadas/recibidas: ${stats.weekly.mentionsSent}/${stats.weekly.mentionsReceived}
  \nMenciones a Munin: ${stats.weekly.muninMentions}
  \nStickers/imágenes/notas de voz: ${stats.weekly.stickers}/${stats.weekly.images}/${stats.weekly.voiceNotes}
  \nPlumas: ${stats.weekly.feathers}
  \nComandos: ${stats.weekly.commandsUsed} · Recordatorios: ${stats.weekly.remindersCreated}
  \nMensajes guardados: ${stats.weekly.messagesSaved} · Encuestas: ${stats.weekly.pollsCreated}
  \nTrivia: ${weeklyTrivia.gamesPlayed || 0} jugadas · ${weeklyTrivia.gamesWon || 0} ganadas
  \nRespuestas correctas: ${weeklyTrivia.correctAnswers || 0}/${weeklyTrivia.questionsAnswered || 0}
  
  \n\n*Hoy*\nMensajes: ${stats.daily.messages} · Palabras: ${stats.daily.words}
  \nRespuestas: ${stats.daily.repliesSent}
  \nMenciones enviadas/recibidas: ${stats.daily.mentionsSent}/${stats.daily.mentionsReceived}
  \nMenciones a Munin: ${stats.daily.muninMentions}
  \nStickers/imágenes/notas de voz: ${stats.daily.stickers}/${stats.daily.images}/${stats.daily.voiceNotes}
  \nPlumas: ${stats.daily.feathers}
  \nTrivia: ${dailyTrivia.gamesPlayed || 0} jugadas · ${dailyTrivia.gamesWon || 0} ganadas
  \nRespuestas correctas: ${dailyTrivia.correctAnswers || 0}/${dailyTrivia.questionsAnswered || 0}
  
  \n\n*Récords*
  \nMensaje más largo: ${stats.records.longestMessage} palabras
  \nRacha más larga: ${stats.records.longestStreak} mensajes
  \nRacha de respuestas correctas actual/mejor: ${lifetimeTrivia.currentCorrectStreak || 0}/${lifetimeTrivia.bestCorrectStreak || 0}`;
}

module.exports = { formatUserStats, presentStatsResult };
