const COMMANDS = Object.freeze({
  MUNIN: "!munin",
  PING: "!ping",
  ECHO: "!echo",
  CREATE_CUSTOM_COMMAND: "!comando",
  LIST_CUSTOM_COMMANDS: "!comandos",
  SAVE_MESSAGE: "!guardar",
  VIEW_SAVED_MESSAGE: "!ver",
  LIST_SAVED_MESSAGES: "!guardados",
  DELETE_SAVED_MESSAGE: "!borrar",
  PENDING: "!p",
  REMINDER: "!r",
  COIN: "!moneda",
  DICE: "!dado",
  EIGHT_BALL: "!bola8",
  RANDOM: "!elige",
  POLL: "!encuesta",
  MULTIPLE_POLL: "!encuestam",
  TIMER: "!tiempo",
  SUMMARY: "!resumen",
  BAN: "!ban",
  CONFIG: "!config",
  UNBAN: "!unban",
  ADMIN: "!admin",
  NO_ADMIN: "!noadmin",
  PAUSE: "!pausa",
  UNPAUSE: "!despausa",
  CURRENT_CLASS: "!clase",
  LIST_CLASSES_TODAY: "!clases",
  LIST_ALL_CLASSES: "!todaslasclases",
  ADD_CLASS: "!agregarclase",
  EDIT_CLASS: "!editarclase",
  DELETE_CLASS: "!eliminarclase",
  BELL: "!campana",
  HELP: "!ayuda",
  STATS: "!stats",
  REPORT: "!reporte",
  USE_REPORT: "!usarreporte",
  CAT: "!gato",
  DOG: "!perro",
  WEATHER: "!clima",
  TRIVIA: "!trivia",
});

const COIN_SIDES = Object.freeze(["cara", "cruz"]);
const INFINITE_TOKEN = "inf";
const EIGHT_BALL_RESPONSES = Object.freeze([
  "Sí",
  "No",
  "Tal vez",
  "Definitivamente",
  "Pregunta de nuevo más tarde",
  "No cuentes con ello",
  "Es cierto",
  "No es cierto",
  "No puedo predecirlo ahora",
  "Las perspectivas son buenas",
  "Las perspectivas no son buenas",
  "Sin duda",
  "No lo creo",
  "Sí, definitivamente",
  "Mis fuentes dicen que no",
  "No puedo decirlo ahora",
  "Concéntrate y pregunta de nuevo",
  "Mi respuesta es no",
  "Mi respuesta es sí",
  "Puedes confiar en ello",
]);

const HELP_PAGE_COUNT = 6;
const HELP_SECTION_INDEX = [
  "Puedes hablar conmigo mencionando a @Munin o usar comandos con !.",
  "Usa `!ayuda <pagina>` para abrir una seccion:",
  "1. General y mensajes guardados",
  "2. Pendientes y recordatorios",
  "3. Diversion y herramientas rapidas",
  "4. Clases",
  "5. Administracion",
  "6. Plumas del cuervo",
].join("\n");
const HELP_PAGES = Object.freeze([
  [
    `=== Ayuda 1/${HELP_PAGE_COUNT}: General ===`,
    HELP_SECTION_INDEX,
    "",
    "**Hablar con Munin**",
    "`!munin`  `!ping`  `!echo hola`",
    "",
    "**Resúmenes**",
    '> Dime *"Resume los últimos 20 mensajes"*.',
    "`!resumen 20`",
    "",
    "**Comandos personalizados**",
    '> Dime *"Cuando diga saluda, di: Hola, manada"*. Luego !saluda',
    "`!comando !saludo Hola, manada`",
    "Consulta o elimina los comandos del grupo: `!comandos`  `!comando - 1`",
    "",
    "**Mensajes guardados**",
    '> Responde a un mensaje y dime *"Guarda esto como reglas"*.',
    "`!guardar reglas`",
    '> Dime *"Muestrame reglas"*.',
    "Puedes verlo, listar los títulos o borrarlo `!ver reglas`  `!guardados`  `!borrar 1`",
    "",
    "Cambia de página con `!ayuda 2`.",
  ].join("\n"),
  [
    `=== Ayuda 2/${HELP_PAGE_COUNT}: Pendientes y recordatorios ===`,
    HELP_SECTION_INDEX,
    "",
    "**Recordatorios**",
    '> Dime *"Recuérdame pagarle a Juan mañana a las 17:00"*.',
    "Como comando relativo desde ahora: `!r 1d pagarle a Juan`",
    "Para repetirlo: `!r 30m x3 tomar agua`  |  Para repetirlo siempre: `!r 30m inf tomar agua`",
    '> Dime *"Muéstra mis recordatorios"* o *"quita el recordatorio 1 de la lista"*.',
    "Consulta o elimina recordatorios: `!r`  `!r - 1`",
    "",
    "**Pendientes**",
    '> Dime *"Anota comprar hielo como pendiente"*.',
    "`!p comprar hielo`",
    "Puedes añadir fecha y hora, o responder a un mensaje: `!p @25/12 10:00 comprar hielo`  `!p`",
    '> Dime *"Muéstra mis pendientes"* o *"quita el pendiente 1 de la lista"*.',
    "Consulta o elimina pendientes: `!p`  `!p - 1`",
  ].join("\n"),
  [
    `=== Ayuda 3/${HELP_PAGE_COUNT}: Diversion y herramientas rapidas ===`,
    HELP_SECTION_INDEX,
    "",
    "**Decidir al azar**",
    '> Dime *"Elige entre pizza y tacos"*.',
    "`!elige pizza, tacos`",
    "Lanza una moneda, un dado o consulta la bola 8: `!moneda`  `!dado`  `!bola8`",
    "",
    "**Trivia**",
    '> Dime *"Inicia una trivia de 10 preguntas"*.',
    "`!trivia 10`",
    "",
    "**Encuestas**",
    "`!encuesta ¿Qué cenamos?,Pizza,Tacos`",
    "Para permitir varias respuestas: `!encuestam Snacks,Papas,Palomitas,Chocolate`",
    "",
    '> Dime *"Pon un temporizador de 10 minutos"*.',
    "**Temporizadores**",
    "`!tiempo 10m`",
    "",
    '> Dime *"Dame una foto de un animal"*.',
    "Manda un gato al grupo: `!gato`",
    "Manda un perro al grupo: `!perro`",
    '> Dime *"Dame el pronóstico de hoy"*.',
    "Consulta el clima de una ubicación y fecha opcional: `!clima`  `!clima San Francisco`  `!clima mañana San Francisco`",
    "",
    "**Estadísticas**",
    "Consulta tus estadísticas o las de alguien: `!stats`  `!stats @usuario`",
    "Consulta el reporte semanal del grupo: `!reporte`",
    "Activa o desactiva el reporte automático semanal: `!usarreporte`",
  ].join("\n"),
  [
    `=== Ayuda 4/${HELP_PAGE_COUNT}: Clases ===`,
    HELP_SECTION_INDEX,
    "",
    '> Dime *"Muéstrame mis clases de hoy"*.',
    '> Dime *"Muéstrame mi horario"*.',
    "Consulta la clase actual o siguiente, las de hoy, o toda la semana: `!clase`  `!clases`  `!todaslasclases`",
    "",
    "**Agregar una clase**",
    '> Dime *"Agrega Matemáticas el lunes de 8 a 9:30 en A-301"*.',
    "`!agregarclase Matemáticas, lunes, 08:00-09:30, A-301`",
    "",
    "**Editar o eliminar**",
    "Usa el nombre o índice de la lista: `!editarclase 2, horario=10:00-11:30`  `!eliminarclase 2`",
    "",
    '> Dime *"Apaga/enciende la campana"*.',
    "**Campana de clases**",
    "Activa o desactiva el aviso de 10 minutos antes de cada clase: `!campana`",
  ].join("\n"),
  [
    `=== Ayuda 5/${HELP_PAGE_COUNT}: Administracion ===`,
    HELP_SECTION_INDEX,
    "",
    "**Bloqueos**",
    "Bloquea temporalmente a alguien o retíralos: `!ban @usuario 1h` `!unban @usuario`",
    `Para un bloqueo indefinido usa: \`!ban @usuario ${INFINITE_TOKEN}\``,
    "Consulta la lista de usuarios bloqueados y administradores: `!config`",
    "",
    "**Administradores**",
    "Da o quita permisos de administrador: `!admin @usuario`  `!noadmin @usuario`",
    "",
    "**Pausar Munin**",
    `Pausa respuestas en este grupo: \`!pausa 30m\`  |  Indefinidamente: \`!pausa ${INFINITE_TOKEN}\``,
    "Reanuda respuestas: `!despausa`",
  ].join("\n"),
  [
    `=== Ayuda 6/${HELP_PAGE_COUNT}: Plumas del cuervo ===`,
    HELP_SECTION_INDEX,
    "",

    `> "De vez en cuando encuentro un mensaje que merece algo más que una respuesta.`,
    "> Puede ser particularmente gracioso, ingenioso, interesante o simplemente demasiado bueno para dejarlo pasar.",
    "> Cuando eso ocurre, dejo una pluma 🪶.",
    "> No puedes pedirlas. No puedes darlas. Y no prometo ser justo.",
    `> Si tienes una, es porque algo que dijiste le gustó mucho a un cuervo." - 🐦‍⬛`,
  ].join("\n"),
]);
const MESSAGES = Object.freeze({
  WELCOME: `¡Hola! Soy Munin 🐦‍⬛, un bot asistente de WhatsApp creado por Capi. Escribe ${COMMANDS.HELP} para ver los comandos disponibles.`,

  PONG: "pong",
  CAT_UNAVAILABLE: "No pude encontrar un gato ahora. Inténtalo de nuevo más tarde.",
  DOG_UNAVAILABLE: "No pude encontrar un perro ahora. Inténtalo de nuevo más tarde.",
  WEATHER_USAGE: `Uso: ${COMMANDS.WEATHER} [fecha] [ubicación]`,
  WEATHER_UNAVAILABLE: "No pude consultar el clima para esa fecha. Inténtalo con una fecha próxima.",
  WEATHER_REPORT: (weather) =>
    `🌦️ ${weather.forecastLabel} en ${weather.location}\n${weather.condition}\nMin: ${weather.minTemperature}°C – Max: ${weather.maxTemperature}°C\nLluvia: ${weather.precipitationChance}% (${weather.precipitation} mm) · Viento: ${weather.maxWindSpeed} km/h`,
  TRIVIA_USAGE: `Uso: ${COMMANDS.TRIVIA} <número de preguntas entre 1 y 50>`,
  TRIVIA_UNAVAILABLE: "No pude conseguir preguntas de trivia ahora. Inténtalo de nuevo más tarde.",
  TRIVIA_ALREADY_ACTIVE: "Ya hay una trivia en curso en este grupo. Terminen esa antes de empezar otra.",
  TRIVIA_STARTING: (seconds) =>
    `🧠 La trivia comienza en ${seconds} segundos, contesten con A, B, C o D. No es necesario mencionarme para contestar, reaccionaré con "🐦‍⬛" cuando vea tu respuesta. ¡Que gane aquel con la mejor memoria!`,
  TRIVIA_QUESTION: (trivia) => formatTriviaQuestion(trivia),
  TRIVIA_SESSION_QUESTION: (question, number, total, durationSeconds) =>
    [
      "🧠 Trivia",
      `Pregunta ${number} de ${total} · ${question.category}`,
      "",
      `*${question.question}*`,
      "",
      ...question.options.map((option) => `${option.letter}. ${option.text}`),
      "",
      `Tienen ${durationSeconds} segundos para responder con A, B, C o D.`,
    ].join("\n"),
  TRIVIA_ANSWER_REVEAL: (question, correctPlayers) =>
    [
      "⏰ Tiempo",
      `La respuesta era *${question.correctOption}. ${question.options.find((option) => option.letter === question.correctOption)?.text}*`,
      correctPlayers.length ? `Acertaron (${correctPlayers.length}): ${correctPlayers.join(", ")}` : "Nadie acertó esta vez.",
    ].join("\n"),
  TRIVIA_SCOREBOARD: (ranking) => formatTriviaRanking("📊 Marcador", ranking),
  TRIVIA_LEADERBOARD: (ranking) => formatTriviaRanking("🏆 Trivia terminada", ranking) + "\nYa he visto suficiente conocimiento.",
  USER_STATS: (stats) => formatUserStats(stats),
  STATS_UNAVAILABLE: "No pude encontrar tus estadísticas todavía.",
  STATS_USAGE: `Uso: ${COMMANDS.STATS} [@usuario]`,
  WEEKLY_REPORT_ENABLED: "Reporte semanal automático activado. Lo enviaré cada domingo a las 08:00.",
  WEEKLY_REPORT_DISABLED: "Reporte semanal automático desactivado.",
  GROUP_REPORT: (stats) =>
    [
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
      "",
      "Ahora sí, lo verdaderamente importante.",
      "*Los títulos de esta semana son:*",
      "",
      formatGroupLeader(
        stats.members,
        "messages",
        "El más ruidoso",
        "mensajes",
        "El grupo guarda un silencio sospechoso.",
        "El cuervo no puede elegir entre tanto ruido",
      ),
      "",
      formatGroupLeader(
        stats.members,
        "repliesSent",
        "El contestón",
        "respuestas",
        "Nadie ha respondido a un mensaje todavía.",
        "El cuervo declara un empate de réplicas",
      ),
      "",
      formatGroupLeader(
        stats.members,
        "mentionsReceived",
        "El favorito",
        "menciones recibidas",
        "Nadie ha sido mencionado todavía.",
        "El cuervo ve popularidad compartida",
      ),
      "",
      formatGroupLeader(
        stats.members,
        "muninMentions",
        "El invocador",
        "menciones a Munin",
        "Nadie me ha convocado aún.",
        "El cuervo escucha un llamado compartido",
      ),
      "",
      formatGroupLeader(
        stats.members,
        "stickers",
        "El que usa demasiados stickers",
        "stickers",
        "Nadie ha usado stickers todavía.",
        "El cuervo detecta una ciencia de stickers compartida",
      ),
      "",
      formatGroupLeader(
        stats.members,
        "images",
        "El fotógrafo",
        "imágenes",
        "Nadie ha compartido imágenes todavía.",
        "El cuervo ve una galería compartida",
      ),
      "",
      formatGroupLeader(
        stats.members,
        "nightMessages",
        "El búho nocturno",
        "mensajes nocturnos",
        "Nadie ha desvelado al cuervo todavía.",
        "El cuervo detecta una vigilia compartida",
      ),
      "",
      formatGroupLeader(
        stats.members,
        "feathers",
        "El favorito del cuervo",
        "plumas",
        "El cuervo no ha entregado plumas todavía.",
        "El cuervo reparte sus plumas por igual",
      ),
      "",
      formatTriviaLeader(stats.members, "gamesWon", "El tryhard", "Nadie ha ganado una trivia todavía.", "El cuervo declara una victoria compartida"),
      "",
      formatTriviaLeader(
        stats.members,
        "correctAnswers",
        "El sabelotodo",
        "Nadie ha acertado una respuesta todavía.",
        "El cuervo ve un empate de sabios",
      ),
      "",
      formatLowestTriviaCorrectAnswers(stats.members, "Al que le falta estudiar"),
      "",
      "🪶 *Ya terminando:*",
      "",
      getWeeklyReportComment(stats.weekly, getWeeklyStatLeaders(stats.members), stats.currentPendings || 0),
    ].join("\n"),
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
  SAVED_MESSAGES_LIST: (messages) =>
    `🐦‍⬛ Cosas que me pediste recordar:\n${messages.map((message, index) => `${index + 1}. ${message.title}`).join("\n")}`,

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
  DAILY_PENDINGS: (groups) =>
    [
      "🐦‍⬛ Esto es lo que se tiene pendiente:",
      groups.expired.length && `Ya se te pasaron:\n${groups.expired.join("\n")}`,
      groups.today.length && `Para hoy, no se te olviden:\n${groups.today.join("\n")}`,
      groups.active.length && `Todavía hay tiempo:\n${groups.active.join("\n")}`,
      groups.noDate.length && `Estos andan sin rumbo ni fecha:\n${groups.noDate.join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
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
  REMINDERS_LIST: (reminders) =>
    `🐦‍⬛ Cosas que no debo dejarte olvidar:\n${reminders.map((reminder, index) => `${index + 1}. ${reminder}`).join("\n")}`,

  DELETE_REMINDER_NOT_FOUND: "No existe un recordatorio con ese índice en este chat.",
  REMINDER_DELETED: (index, content) => `Recordatorio ${index} eliminado: ${content}`,

  COIN_RESULT: (coinFlip) => `\u{1FA99} Ha salido ${coinFlip}`,
  DICE_RESULT: (diceRoll) => `\u{1F3B2} Has sacado un ${diceRoll}`,
  EIGHT_BALL_RESULT: (response) => `\u{1F3B1} La bola 8 dice: ${response}`,

  RANDOM_RESULT: (choice) => `\u{1F3B2} He elegido: ${choice}`,
  RANDOM_USAGE: `Uso: ${COMMANDS.RANDOM} <opción1>, <opción2> ... , <opciónN>`,

  POLL_USAGE: `Uso: ${COMMANDS.POLL} <título>,<opción1>,<opción2>,...,<opciónN>`,

  // Class messages
  CURRENT_CLASS_ACTIVE: (cls) => `📚 Ahora: ${cls.name} (${cls.startTime} - ${cls.endTime}) en ${cls.classroom}`,
  CURRENT_CLASS_NEXT: (cls, day) => `📚 Siguiente: ${cls.name} — ${day} ${cls.startTime} - ${cls.endTime} en ${cls.classroom}`,
  NO_CLASSES: "No hay clases registradas.",
  CLASSES_TODAY: (day, lines, bellEnabled) =>
    `🐦‍⬛ Estas son las clases de hoy (${day}):\n${bellEnabled ? "🔔 Campana activada" : "🔕 Campana desactivada"}\n\n${lines.join("\n")}`,
  NO_CLASSES_TODAY: "No hay clases hoy.",
  ALL_CLASSES: (dayGroups, bellEnabled) =>
    `🐦‍⬛ Estas son todas las clases:\n${bellEnabled ? "🔔 Campana activada" : "🔕 Campana desactivada"}\n\n${dayGroups.join("\n\n")}`,
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
  CONFIG_LIST: (bans, admins) =>
    [
      "*Configuración del grupo*",
      "",
      "*Usuarios bloqueados:*",
      bans.length
        ? bans.map(({ userId, remaining }) => `@${userId.split("@")[0]} — ${remaining}`).join("\n")
        : "No hay usuarios bloqueados en este grupo.",
      "",
      "*Administradores:*",
      admins.length ? admins.map((userId) => `@${userId.split("@")[0]}`).join("\n") : "No hay administradores en este grupo.",
    ].join("\n"),
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
  HELP_PAGE: (page) => HELP_PAGES[page - 1],
  HELP_PAGE_USAGE: `Uso: ${COMMANDS.HELP} <página del 1 al ${HELP_PAGE_COUNT}>`,
});

function formatGroupLeader(members, metric, title, unit, zeroMessage, tieMessage) {
  const highest = Math.max(0, ...members.map((member) => member.weekly?.[metric] || 0));
  if (highest === 0) return `${title}\n> ${zeroMessage}`;

  const leaders = members.filter((member) => (member.weekly?.[metric] || 0) === highest).map((member) => member.name);
  const displayUnit = highest === 1 ? singularGroupUnit(unit) : unit;
  if (leaders.length === 1) return `${title}\n> ${leaders[0]} — ${highest} ${displayUnit}`;
  return `${title}\n> ${tieMessage}: ${leaders.join(", ")} — ${highest} ${displayUnit}`;
}

function formatTriviaLeader(members, metric, title, zeroMessage, tieMessage) {
  const highest = Math.max(0, ...members.map((member) => member.weekly?.trivia?.[metric] || 0));
  if (highest === 0) return `${title}\n> ${zeroMessage}`;

  const leaders = members.filter((member) => (member.weekly?.trivia?.[metric] || 0) === highest).map((member) => member.name);
  if (leaders.length === 1) return `${title}\n> ${leaders[0]} — ${highest}`;
  return `${title}\n> ${tieMessage}: ${leaders.join(", ")} — ${highest}`;
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
  return [
    "🧠 Trivia",
    `Pregunta 1 de ${trivia.results.length} · ${question.category}`,
    "",
    `*${question.question}*`,
    "",
    ...answers.map((answer, index) => `${String.fromCharCode(65 + index)}. ${answer}`),
  ].join("\n");
}

function formatTriviaRanking(title, ranking) {
  if (!ranking.length) return `${title}\n\nNadie respondió la trivia.`;
  return [
    title,
    "",
    ...ranking.map((player, index) => `${index + 1}. ${player.name} — ${player.score} ${player.score === 1 ? "punto" : "puntos"}`),
  ].join("\n");
}

function shuffleTriviaAnswers(answers) {
  const shuffled = [...answers];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
  }
  return shuffled;
}

const STICKER_THRESHOLD = 30;
const STICKER_PROPORTION_THRESHOLD = 0.3;
const MUNIN_MENTIONS_THRESHOLD = 30;
const PENDING_THRESHOLD = 5;
const REMINDER_THRESHOLD = 4;
const POLL_THRESHOLD = 3;
const LOW_MESSAGE_THRESHOLD = 15;
const TRIVIA_PARTICIPATION_THRESHOLD = 6;
const TRIVIA_ANSWER_THRESHOLD = 8;
const TRIVIA_HIGH_ACCURACY_THRESHOLD = 0.75;
const TRIVIA_LOW_ACCURACY_THRESHOLD = 0.3;
const TRIVIA_WINS_THRESHOLD = 2;

function getWeeklyReportComment(weekly, leaders, currentPendings) {
  let observations = "";
  const trivia = weekly.trivia || {};
  if (weekly.stickers > STICKER_THRESHOLD) {
    const stickerLeaders = leaders.stickers.names.join(", ");
    observations += `\nEl cuervo concluye que ${stickerLeaders} ya domina el idioma de los stickers.`;
  }

  if (weekly.stickers > weekly.messages * STICKER_PROPORTION_THRESHOLD) {
    observations += "\nUna parte preocupante de esta conversación fueron stickers.";
  }

  if (weekly.muninMentions > MUNIN_MENTIONS_THRESHOLD) {
    observations += `\nMe invocaron ${weekly.muninMentions} veces. Empiezo a creer que el grupo depende de mí.`;
  }

  if (currentPendings >= PENDING_THRESHOLD) {
    observations += `\nHay ${currentPendings} pendientes abiertos. Este grupo siempre está ocupado.`;
  }

  if (weekly.remindersCreated >= REMINDER_THRESHOLD) {
    observations += `\nCrearon ${weekly.remindersCreated} recordatorios. A este grupo siempre se le olvida todo.`;
  }

  if (weekly.pollsCreated >= POLL_THRESHOLD) {
    observations += `\nHicieron ${weekly.pollsCreated} encuestas. Son muy indecisos todos.`;
  }

  if ((trivia.gamesPlayed || 0) >= TRIVIA_PARTICIPATION_THRESHOLD) {
    observations += `\nAcumularon ${trivia.gamesPlayed} participaciones en trivia. El cuervo ya sospecha que estudian a escondidas.`;
  }

  if ((trivia.gamesWon || 0) >= TRIVIA_WINS_THRESHOLD) {
    observations += `\n${leaders.trivia.gamesWon.names.join(", ")} está dominando las trivias con ${leaders.trivia.gamesWon.value} victorias.`;
  }

  const triviaAccuracy = (trivia.correctAnswers || 0) / (trivia.questionsAnswered || 1);
  if ((trivia.questionsAnswered || 0) >= TRIVIA_ANSWER_THRESHOLD && triviaAccuracy >= TRIVIA_HIGH_ACCURACY_THRESHOLD) {
    observations += `\nCon ${Math.round(triviaAccuracy * 100)}% de respuestas correctas, este grupo ya está listo para pelear contra Odín en una trivia.`;
  } else if ((trivia.questionsAnswered || 0) >= TRIVIA_ANSWER_THRESHOLD && triviaAccuracy <= TRIVIA_LOW_ACCURACY_THRESHOLD) {
    observations += `\nSolo acertaron ${Math.round(triviaAccuracy * 100)}% de las preguntas de trivia. El cuervo recomienda abrir un libro de vez en cuando.`;
  }

  if (weekly.messages < LOW_MESSAGE_THRESHOLD) {
    observations += `\nEl grupo ahora está en Valhalla (muerto).`;
  }

  observations += `\nEl cuervo archivó ${weekly.messages} mensajes esta semana y aún conserva algunas plumas.\nSeguiré observando...`;
  return observations;
}

function getWeeklyStatLeaders(members) {
  const metrics = [
    "messages",
    "nightMessages",
    "repliesSent",
    "mentionsSent",
    "mentionsReceived",
    "muninMentions",
    "stickers",
    "images",
    "voiceNotes",
    "feathers",
    "words",
    "commandsUsed",
    "remindersCreated",
    "messagesSaved",
    "pollsCreated",
  ];

  return {
    ...Object.fromEntries(metrics.map((metric) => [metric, getWeeklyStatLeader(members, metric)])),
    trivia: {
      gamesWon: getWeeklyTriviaLeader(members, "gamesWon"),
      correctAnswers: getWeeklyTriviaLeader(members, "correctAnswers"),
    },
  };
}

function getWeeklyStatLeader(members, metric) {
  const value = Math.max(0, ...members.map((member) => member.weekly?.[metric] || 0));
  return {
    value,
    names: value ? members.filter((member) => (member.weekly?.[metric] || 0) === value).map((member) => member.name) : [],
  };
}

function getWeeklyTriviaLeader(members, metric) {
  const value = Math.max(0, ...members.map((member) => member.weekly?.trivia?.[metric] || 0));
  return {
    value,
    names: value ? members.filter((member) => (member.weekly?.trivia?.[metric] || 0) === value).map((member) => member.name) : [],
  };
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

module.exports = {
  COIN_SIDES,
  COMMANDS,
  EIGHT_BALL_RESPONSES,
  INFINITE_TOKEN,
  MESSAGES,
};
