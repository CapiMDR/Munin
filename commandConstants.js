const COMMANDS = Object.freeze({
  MUNIN: "!munin",
  PING: "!ping",
  ECHO: "!echo",
  ADD_NOTE: "!nota",
  LIST_NOTES: "!notas",
  DELETE_NOTE: "!borrarnota",
  ADD_REMINDER: "!memo",
  LIST_REMINDERS: "!memos",
  DELETE_REMINDER: "!borrarmemo",
  COIN: "!moneda",
  DICE: "!dado",
  EIGHT_BALL: "!bola8",
  RANDOM: "!escoge",
  POLL: "!encuesta",
  MULTIPLE_POLL: "!encuestam",
  HELP: "!ayuda",
});

const COIN_SIDES = Object.freeze(["cara", "cruz"]);
const EIGHT_BALL_RESPONSES = Object.freeze([
  "Sí",
  "No",
  "Tal vez",
  "Definitivamente",
  "Pregunta de nuevo más tarde",
  "No cuentes con ello",
  "Es cierto",
  "No es cierto",
]);

const MESSAGES = Object.freeze({
  WELCOME: `¡Hola! Soy Munin, tu bot asistente de WhatsApp. Escribe ${COMMANDS.HELP} para ver los comandos disponibles.`,

  PONG: "pong",

  ADD_NOTE_USAGE: `Uso: ${COMMANDS.ADD_NOTE} <nota> o responde a un mensaje con ${COMMANDS.ADD_NOTE}`,
  NOTE_ADDED: (content) => `Nota agregada: ${content}`,
  NO_NOTES: "No hay notas guardadas para este chat.",
  NOTES_LIST: (notes) => `Notas:\n${notes.map((note, index) => `${index + 1}. ${note}`).join("\n")}`,
  DELETE_NOTE_USAGE: `Uso: ${COMMANDS.DELETE_NOTE} <índice>`,
  DELETE_NOTE_NOT_FOUND: "No existe una nota con ese índice en este chat.",
  NOTE_DELETED: (index) => `Nota ${index} eliminada.`,
  ADD_REMINDER_USAGE: `Uso: ${COMMANDS.ADD_REMINDER} <cantidad><m/h/d> <contenido>. Ejemplo: ${COMMANDS.ADD_REMINDER} 30m barrer`,

  REMINDER_ADDED: (userTag, time, content) => `${userTag ? `${userTag} ` : ""}Te recordaré en ${time}: ${content}`,
  NO_REMINDERS: "No hay recordatorios guardados para este chat.",
  REMINDERS_LIST: (reminders) => `Recordatorios:\n${reminders.map((reminder, index) => `${index + 1}. ${reminder}`).join("\n")}`,
  DELETE_REMINDER_USAGE: `Uso: ${COMMANDS.DELETE_REMINDER} <índice>`,
  DELETE_REMINDER_NOT_FOUND: "No existe un recordatorio con ese índice en este chat.",

  REMINDER_DELETED: (index) => `Recordatorio ${index} eliminado.`,
  COIN_RESULT: (coinFlip) => `\u{1FA99} Ha salido ${coinFlip}`,
  DICE_RESULT: (diceRoll) => `\u{1F3B2} Has sacado un ${diceRoll}`,
  EIGHT_BALL_RESULT: (response) => `\u{1F3B1} La bola 8 dice: ${response}`,

  RANDOM_RESULT: (choice) => `\u{1F3B2} He elegido: ${choice}`,
  RANDOM_USAGE: `Uso: ${COMMANDS.RANDOM} <opción1>, <opción2> ... , <opciónN>`,

  POLL_USAGE: `Uso: ${COMMANDS.POLL} <título>,<opción1>,<opción2>,...,<opciónN>`,

  UNKNOWN_COMMAND: `Comando no reconocido. Escribe ${COMMANDS.HELP} para ver los comandos disponibles.`,
  HELP: [
    "Comandos:",
    `${COMMANDS.MUNIN} - Saludar al bot`,
    `${COMMANDS.PING} - Probar el bot`,
    `${COMMANDS.ECHO} <texto> - Repetir texto`,
    `${COMMANDS.ADD_NOTE} <nota> - Guardar una nota`,
    `${COMMANDS.LIST_NOTES} - Mostrar las notas del chat`,
    `${COMMANDS.DELETE_NOTE} <índice> - Eliminar una nota`,
    `${COMMANDS.ADD_REMINDER} <cantidad><m/h/d> <contenido> - Crear un recordatorio`,
    `${COMMANDS.LIST_REMINDERS} - Mostrar los recordatorios del chat`,
    `${COMMANDS.DELETE_REMINDER} <índice> - Eliminar un recordatorio`,
    `${COMMANDS.COIN} - Lanzar una moneda`,
    `${COMMANDS.DICE} - Lanzar un dado`,
    `${COMMANDS.EIGHT_BALL} - Preguntar a la bola 8`,
    `${COMMANDS.RANDOM} <opción1>, <opción2> ... , <opciónN> - Elegir una opción al azar`,
    `${COMMANDS.POLL} <título>,<opción1>,<opción2>,...,<opciónN> - Crear una encuesta`,
    `${COMMANDS.MULTIPLE_POLL} <título>,<opción1>,<opción2>,...,<opciónN> - Crear una encuesta de selección múltiple`,
    `${COMMANDS.HELP} - Mostrar comandos`,
  ].join("\n"),
});

module.exports = {
  COIN_SIDES,
  COMMANDS,
  EIGHT_BALL_RESPONSES,
  MESSAGES,
};
