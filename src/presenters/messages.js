const { COMMANDS, INFINITE_TOKEN } = require("../config/commandConstants");

const MESSAGES = Object.freeze({
  WELCOME: `¡Hola! Soy Munin 🐦‍⬛, un bot asistente de WhatsApp creado por Capi. Escribe ${COMMANDS.HELP} para ver los comandos disponibles.`,
  PONG: "pong",
  CAT_UNAVAILABLE: "No pude encontrar un gato ahora. Inténtalo de nuevo más tarde.",
  DOG_UNAVAILABLE: "No pude encontrar un perro ahora. Inténtalo de nuevo más tarde.",
  WEATHER_USAGE: `Uso: ${COMMANDS.WEATHER} [fecha] [ubicación]`,
  WEATHER_UNAVAILABLE: "No pude consultar el clima para esa fecha. Inténtalo con una fecha próxima.",
  WEATHER_REPORT: (weather) => `🌦️ ${weather.forecastLabel} en ${weather.location}\n${weather.condition}\nMin: ${weather.minTemperature}°C – Max: ${weather.maxTemperature}°C\nLluvia: ${weather.precipitationChance}% (${weather.precipitation} mm) · Viento: ${weather.maxWindSpeed} km/h`,
  TRIVIA_USAGE: `Uso: ${COMMANDS.TRIVIA} <número de preguntas entre 1 y 50>`,
  TRIVIA_UNAVAILABLE: "No pude conseguir preguntas de trivia ahora. Inténtalo de nuevo más tarde.",
  TRIVIA_ALREADY_ACTIVE: "Ya hay una trivia en curso en este grupo. Terminen esa antes de empezar otra.",
  TRIVIA_STARTING: (seconds) => `🧠 La trivia comienza en ${seconds} segundos, contesten con A, B, C o D. No es necesario mencionarme para contestar, reaccionaré con "🐦‍⬛" cuando vea tu respuesta. ¡Que gane aquel con la mejor memoria!`,
  TRIVIA_QUESTION: (trivia) => formatTriviaQuestion(trivia),
  TRIVIA_SESSION_QUESTION: (question, number, total, durationSeconds) => ["🧠 Trivia", `Pregunta ${number} de ${total} · ${question.category}`, "", `*${question.question}*`, "", ...question.options.map((option) => `${option.letter}. ${option.text}`), "", `Tienen ${durationSeconds} segundos para responder con A, B, C o D.`].join("\n"),
  TRIVIA_ANSWER_REVEAL: (question, correctPlayers) => ["⏰ Tiempo", `La respuesta era *${question.correctOption}. ${question.options.find((option) => option.letter === question.correctOption)?.text}*`, correctPlayers.length ? `Acertaron (${correctPlayers.length}): ${correctPlayers.join(", ")}` : "Nadie acertó esta vez."].join("\n"),
  TRIVIA_SCOREBOARD: (ranking) => formatTriviaRanking("📊 Marcador", ranking),
  TRIVIA_LEADERBOARD: (ranking) => `${formatTriviaRanking("🏆 Trivia terminada", ranking)}\nYa he visto suficiente conocimiento.`,
  USER_STATS: (stats) => formatUserStats(stats),
  STATS_UNAVAILABLE: "No pude encontrar tus estadísticas todavía.",
  STATS_USAGE: `Uso: ${COMMANDS.STATS} [@usuario]`,
  WEEKLY_REPORT_ENABLED: "Reporte semanal automático activado. Lo enviaré cada domingo a las 18:00.",
  WEEKLY_REPORT_DISABLED: "Reporte semanal automático desactivado.",
  MUTATION_WITH_LIST: (confirmation, list) => `${confirmation}\n\n${list}`,
  SUMMARY_USAGE: (maxAmount) => `Uso: ${COMMANDS.SUMMARY} <cantidad entre 1 y ${maxAmount}>`,
  SUMMARY_NO_MESSAGES: "No hay mensajes anteriores para resumir en este chat.",
  SUMMARY_UNAVAILABLE: "No pude generar el resumen. Inténtalo de nuevo.",
  SAVE_MESSAGE_USAGE: `Uso: responde a un mensaje con ${COMMANDS.SAVE_MESSAGE} <título>`,
  SAVED_MESSAGE_CREATED: (title) => `Mensaje guardado como: ${title}`,
  SAVED_MESSAGE_UPDATED: (title) => `Mensaje guardado actualizado: ${title}`,
  VIEW_SAVED_MESSAGE_USAGE: `Uso: ${COMMANDS.VIEW_SAVED_MESSAGE} <título>`,
  SAVED_MESSAGE_REPLY: (title) => `Mensaje guardado: ${title}`,
  SAVED_MESSAGE_NOT_FOUND: (title) => `No existe un mensaje guardado con el título: ${title}`,
  DELETE_SAVED_MESSAGE_USAGE: `Uso: ${COMMANDS.DELETE_SAVED_MESSAGE} <índice>`,
  SAVED_MESSAGE_INDEX_NOT_FOUND: "No existe un mensaje guardado con ese índice.",
  SAVED_MESSAGE_DELETED: (title) => `Mensaje guardado eliminado: ${title}`,
  NO_SAVED_MESSAGES: "No hay mensajes guardados en este grupo.",
  SAVED_MESSAGES_LIST: (messages) => `🐦‍⬛ Cosas que me pediste recordar.\nUsa !ver <nombre> para verlas:\n${messages.map((message, index) => `${index + 1}. ${message.title}`).join("\n")}`,
  CUSTOM_COMMAND_USAGE: `Uso: ${COMMANDS.CREATE_CUSTOM_COMMAND} !<nombre> <respuesta>`,
  CUSTOM_COMMAND_CREATED: (command, reply) => `Cuando digas ${command} diré ${reply}`,
  CUSTOM_COMMAND_UPDATED: (command) => `Comando personalizado actualizado: ${command}`,
  CUSTOM_COMMAND_DELETED: (command) => `Comando personalizado eliminado: ${command}`,
  CUSTOM_COMMAND_BUILTIN_CONFLICT: (command) => `No puedes sobrescribir ${command} porque es un comando del bot.`,
  DELETE_CUSTOM_COMMAND_USAGE: `Uso: ${COMMANDS.CREATE_CUSTOM_COMMAND} - <índice>`,
  CUSTOM_COMMAND_INDEX_NOT_FOUND: "No existe un comando personalizado con ese índice.",
  NO_CUSTOM_COMMANDS: "No hay comandos personalizados en este grupo.",
  CUSTOM_COMMANDS_LIST: (commands) => `Comandos personalizados:\n${commands.map((command, index) => `${index + 1}. ${command.command}`).join("\n")}`,
  PENDING_USAGE: `Uso: ${COMMANDS.PENDING} [@<dd/mm>] [HH:mm] <pendiente>, responde a un mensaje con ${COMMANDS.PENDING}, o usa ${COMMANDS.PENDING} - <índice> para eliminarlo`,
  PENDING_ADDED: (content, date, time) => `Pendiente agregado${date ? ` para ${date}` : ""}${time ? ` a las ${time}` : ""}: ${content}`,
  NO_PENDING: "No hay pendientes guardados para este chat.",
  DAILY_PENDINGS: (groups) => ["🐦‍⬛ Esto es lo que se tiene pendiente:", groups.expired.length && `Ya se te pasaron:\n${groups.expired.join("\n")}`, groups.today.length && `Para hoy, no se te olviden:\n${groups.today.join("\n")}`, groups.active.length && `Todavía hay tiempo:\n${groups.active.join("\n")}`, groups.noDate.length && `Estos andan sin rumbo ni fecha:\n${groups.noDate.join("\n")}`].filter(Boolean).join("\n\n"),
  DELETE_PENDING_NOT_FOUND: "No existe un pendiente con ese índice en este chat.",
  PENDING_DELETED: (index, content) => `Pendiente ${index} eliminado: ${content}`,
  REMINDER_USAGE: `Uso: ${COMMANDS.REMINDER} <cantidad><m/h/d> [x<veces> o ${INFINITE_TOKEN}] <contenido>. Responde a un mensaje para usarlo como contenido; ${COMMANDS.REMINDER} - <índice> lo elimina. Los recordatorios repetidos requieren un mínimo de 10m.`,
  REMINDER_INVALID_DURATION: "No entendí el tiempo del recordatorio. Usa una cantidad positiva seguida de m, h o d; por ejemplo: 30m, 2h o 1d.",
  REMINDER_INVALID_ABSOLUTE_TIME: "No entendí la fecha u hora del recordatorio. Usa hoy o mañana y una hora HH:mm, por ejemplo: hoy a las 10:00.",
  REMINDER_TIME_ALREADY_PASSED: "Esa hora de hoy ya paso. Indica una hora futura o pide el recordatorio para mañana.",
  RECURRING_REMINDER_ADDED: (interval, repetitions, content) => `Recordatorio repetido cada ${interval}, ${repetitions}: ${content}`,
  REMINDER_ADDED: (userTag, time, content) => `${userTag ? `${userTag} ` : ""}Te recordaré en ${time}: ${content}`,
  REMINDER_CREATED: (content, dueAt) => `Recordatorio agregado para ${dueAt}: ${content}`,
  REMINDER_DUE: (content) => `🐦‍⬛ Recordar: ${content}`,
  NO_REMINDERS: "No hay recordatorios guardados para este chat.",
  REMINDERS_LIST: (reminders) => `🐦‍⬛ Cosas que no debo dejarte olvidar:\n${reminders.map((reminder, index) => `${index + 1}. ${reminder}`).join("\n")}`,
  DELETE_REMINDER_NOT_FOUND: "No existe un recordatorio con ese índice en este chat.",
  REMINDER_DELETED: (index, content) => `Recordatorio ${index} eliminado: ${content}`,
  COIN_RESULT: (coinFlip) => `🪙 Ha salido ${coinFlip}`,
  DICE_RESULT: (diceRoll) => `🎲 Has sacado un ${diceRoll}`,
  EIGHT_BALL_RESULT: (response) => `🎱 La bola 8 dice: ${response}`,
  RANDOM_RESULT: (choice) => `🎲 He elegido: ${choice}`,
  RANDOM_USAGE: `Uso: ${COMMANDS.RANDOM} <opción1>, <opción2> ... , <opciónN>`,
  POLL_USAGE: `Uso: ${COMMANDS.POLL} <título>,<opción1>,<opción2>,...,<opciónN>`,
  CURRENT_CLASS_ACTIVE: (cls) => `📚 Ahora: ${cls.name} (${cls.startTime} - ${cls.endTime}) en ${cls.classroom}`,
  CURRENT_CLASS_NEXT: (cls, day) => `📚 Siguiente: ${cls.name} — ${day} ${cls.startTime} - ${cls.endTime} en ${cls.classroom}`,
  NO_CLASSES: "No hay clases registradas.",
  CLASSES_TODAY: (day, lines, bellEnabled) => `🐦‍⬛ Estas son las clases de hoy (${day}):\n${bellEnabled ? "🔔 Campana activada" : "🔕 Campana desactivada"}\n\n${lines.join("\n")}`,
  NO_CLASSES_TODAY: "No hay clases hoy.",
  ALL_CLASSES: (dayGroups, bellEnabled) => `🐦‍⬛ Estas son todas las clases:\n${bellEnabled ? "🔔 Campana activada" : "🔕 Campana desactivada"}\n\n${dayGroups.join("\n\n")}`,
  ADD_CLASS_USAGE: `Uso: ${COMMANDS.ADD_CLASS} <nombre>, <día>, <inicio>-<fin>, <salón>\nEjemplo: ${COMMANDS.ADD_CLASS} Matemáticas, Lunes, 8:00-9:30, A-301`,
  CLASS_ADDED: (cls, day) => `✅ Clase agregada: ${cls.name} — ${day} ${cls.startTime} - ${cls.endTime} en ${cls.classroom}`,
  INVALID_DAY: "Día inválido. Usa: lunes, martes, miércoles, jueves, viernes, sábado, domingo.",
  INVALID_TIME: "Formato de horario inválido. Usa HH:mm-HH:mm (ej: 8:00-9:30).",
  EDIT_CLASS_USAGE: `Uso: ${COMMANDS.EDIT_CLASS} <nombre o índice>, <campo>=<valor>\nCampos: nombre, día, horario (HH:mm-HH:mm), salón\nEjemplo: ${COMMANDS.EDIT_CLASS} 2, horario=10:00-11:30`,
  CLASS_EDITED: (cls, day) => `✅ Clase editada: ${cls.name} — ${day} ${cls.startTime} - ${cls.endTime} en ${cls.classroom}`,
  EDIT_UNKNOWN_FIELD: (field) => `Campo desconocido: "${field}". Campos válidos: nombre, día, horario, salón.`,
  DELETE_CLASS_USAGE: `Uso: ${COMMANDS.DELETE_CLASS} <nombre o índice>`,
  CLASS_DELETED: (name) => `🗑️ Clase eliminada: ${name}`,
  CLASS_NOT_FOUND: "No se encontró la clase.",
  CLASS_AMBIGUOUS: (lines) => `Hay varias clases con ese nombre. Usa el índice de ${COMMANDS.LIST_ALL_CLASSES}:\n${lines.join("\n")}`,
  BELL_ON: "🔔 Recordatorios de 10 minutos antes de clase activados.",
  BELL_OFF: "🔕 Recordatorios de 10 minutos antes de clase desactivados.",
  CLASS_REMINDER: (cls) => `🔔 ${cls.name} empieza en 10 minutos (${cls.classroom})`,
  TIMER_USAGE: `Uso: ${COMMANDS.TIMER} <cantidad><s/m/h>`,
  TIMER_STARTED: (duration) => `🐦‍⬛ Estaré contando por ${duration}.`,
  TIMER_FINISHED: "⏰ El tiempo se ha acabado.",
  ADMIN_ONLY: "Este comando es solo para administradores.",
  BAN_USAGE: `Uso: ${COMMANDS.BAN} @usuario <cantidad><m/h/d> o ${INFINITE_TOKEN}`,
  ADMIN_USAGE: `Uso: ${COMMANDS.ADMIN} @usuario`,
  NO_ADMIN_USAGE: `Uso: ${COMMANDS.NO_ADMIN} @usuario`,
  PAUSE_USAGE: `Uso: ${COMMANDS.PAUSE} <cantidad><m/h/d> o ${INFINITE_TOKEN}`,
  USER_BANNED: (duration) => `Usuario bloqueado por ${duration}.`,
  USER_BANNED_INDEFINITELY: "Usuario bloqueado indefinidamente.",
  CONFIG_LIST: (bans, admins) => ["*Configuración del grupo*", "", "*Usuarios bloqueados:*", bans.length ? bans.map(({ userId, remaining }) => `@${userId.split("@")[0]} — ${remaining}`).join("\n") : "No hay usuarios bloqueados en este grupo.", "", "*Administradores:*", admins.length ? admins.map((userId) => `@${userId.split("@")[0]}`).join("\n") : "No hay administradores en este grupo."].join("\n"),
  ADMIN_ADDED: "Administrador agregado para este grupo.",
  ADMIN_REMOVED: "Administrador eliminado de este grupo.",
  GLOBAL_ADMIN_PROTECTED: "El administrador global no puede ser removido.",
  BOT_PAUSED: (duration) => `Bot pausado por ${duration}.`,
  BOT_PAUSED_INDEFINITELY: "Bot pausado indefinidamente.",
  TEST_MODE_MAINTENANCE: "🐦‍⬛ *Munin está arreglándose las plumas.*\nPor ahora no podré responder. Volveré cuando todo esté en orden.",
  UNBAN_USAGE: `Uso: ${COMMANDS.UNBAN} @usuario`,
  USER_UNBANNED: "Usuario desbloqueado.",
  USER_NOT_BANNED: "El usuario no está bloqueado.",
  BOT_UNPAUSED: "Bot reanudado en este grupo.",
  BOT_NOT_PAUSED: "El bot no está pausado en este grupo.",
  SUGGEST_SIMILAR_COMMAND: (command) => `Intenta ${command} o usa !ayuda para ver los comandos disponibles`,
  UNKNOWN_COMMAND: (command) => `Comando no reconocido: ${command}. Escribe ${COMMANDS.HELP} para ver los comandos disponibles.`,
});

function formatUserStats(stats) {
  const lifetimeTrivia = stats.lifetime.trivia || {};
  const weeklyTrivia = stats.weekly.trivia || {};
  const dailyTrivia = stats.daily.trivia || {};
  return `🐦‍⬛ Estadísticas de ${stats.name}:\n\n*Total*\nMensajes: ${stats.lifetime.messages} · Palabras: ${stats.lifetime.words}\nRespuestas: ${stats.lifetime.repliesSent}\nMenciones enviadas/recibidas: ${stats.lifetime.mentionsSent}/${stats.lifetime.mentionsReceived}\nMenciones a Munin: ${stats.lifetime.muninMentions}\nStickers/imágenes/notas de voz: ${stats.lifetime.stickers}/${stats.lifetime.images}/${stats.lifetime.voiceNotes}\nPlumas: ${stats.lifetime.feathers}\nComandos: ${stats.lifetime.commandsUsed} · Recordatorios: ${stats.lifetime.remindersCreated}\nMensajes guardados: ${stats.lifetime.messagesSaved} · Encuestas: ${stats.lifetime.pollsCreated}\nTrivia: ${lifetimeTrivia.gamesPlayed || 0} jugadas · ${lifetimeTrivia.gamesWon || 0} ganadas\nRespuestas correctas: ${lifetimeTrivia.correctAnswers || 0}/${lifetimeTrivia.questionsAnswered || 0}\n\n*Esta semana*\nMensajes: ${stats.weekly.messages} · Palabras: ${stats.weekly.words}\nRespuestas: ${stats.weekly.repliesSent}\nMenciones enviadas/recibidas: ${stats.weekly.mentionsSent}/${stats.weekly.mentionsReceived}\nMenciones a Munin: ${stats.weekly.muninMentions}\nStickers/imágenes/notas de voz: ${stats.weekly.stickers}/${stats.weekly.images}/${stats.weekly.voiceNotes}\nPlumas: ${stats.weekly.feathers}\nComandos: ${stats.weekly.commandsUsed} · Recordatorios: ${stats.weekly.remindersCreated}\nMensajes guardados: ${stats.weekly.messagesSaved} · Encuestas: ${stats.weekly.pollsCreated}\nTrivia: ${weeklyTrivia.gamesPlayed || 0} jugadas · ${weeklyTrivia.gamesWon || 0} ganadas\nRespuestas correctas: ${weeklyTrivia.correctAnswers || 0}/${weeklyTrivia.questionsAnswered || 0}\n\n*Hoy*\nMensajes: ${stats.daily.messages} · Palabras: ${stats.daily.words}\nRespuestas: ${stats.daily.repliesSent}\nMenciones enviadas/recibidas: ${stats.daily.mentionsSent}/${stats.daily.mentionsReceived}\nMenciones a Munin: ${stats.daily.muninMentions}\nStickers/imágenes/notas de voz: ${stats.daily.stickers}/${stats.daily.images}/${stats.daily.voiceNotes}\nPlumas: ${stats.daily.feathers}\nTrivia: ${dailyTrivia.gamesPlayed || 0} jugadas · ${dailyTrivia.gamesWon || 0} ganadas\nRespuestas correctas: ${dailyTrivia.correctAnswers || 0}/${dailyTrivia.questionsAnswered || 0}\n\n*Récords*\nMensaje más largo: ${stats.records.longestMessage} palabras\nRacha más larga: ${stats.records.longestStreak} mensajes\nRacha de respuestas correctas actual/mejor: ${lifetimeTrivia.currentCorrectStreak || 0}/${lifetimeTrivia.bestCorrectStreak || 0}`;
}

function formatTriviaQuestion(trivia) {
  const question = trivia?.results?.[0];
  if (!question) return MESSAGES.TRIVIA_UNAVAILABLE;
  const answers = shuffleTriviaAnswers([question.correct_answer, ...question.incorrect_answers]);
  return ["🧠 Trivia", `Pregunta 1 de ${trivia.results.length} · ${question.category}`, "", `*${question.question}*`, "", ...answers.map((answer, index) => `${String.fromCharCode(65 + index)}. ${answer}`)].join("\n");
}

function formatTriviaRanking(title, ranking) {
  if (!ranking.length) return `${title}\n\nNadie respondió la trivia.`;
  return [title, "", ...ranking.map((player, index) => `${index + 1}. ${player.name} — ${player.score} ${player.score === 1 ? "punto" : "puntos"}`)].join("\n");
}

function shuffleTriviaAnswers(answers) {
  const shuffled = [...answers];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
  }
  return shuffled;
}

module.exports = { MESSAGES };
