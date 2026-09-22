const COMMANDS = Object.freeze({
  MUNIN: "!munin",
  PING: "!ping",
  ECHO: "!echo",
  ADD_NOTE: "!nota",
  DELETE_NOTE: "!borrarnota",
  LIST_NOTES: "!notas",
  COIN: "!moneda",
  DICE: "!dado",
  EIGHT_BALL: "!bola8",
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
  WELCOME: "¡Hola! Soy Munin, tu bot asistente de WhatsApp. Escribe !ayuda para ver los comandos disponibles.",
  PONG: "pong",
  ADD_NOTE_USAGE: `Uso: ${COMMANDS.ADD_NOTE} <nota> o responde a un mensaje con ${COMMANDS.ADD_NOTE}`,
  NOTE_ADDED: "Nota agregada.",
  NO_NOTES: "No hay notas guardadas para este chat.",
  NOTES_HEADING: "Notas:",
  DELETE_NOTE_USAGE: `Uso: ${COMMANDS.DELETE_NOTE} <índice>`,
  DELETE_NOTE_NOT_FOUND: "No existe una nota con ese índice en este chat.",
  NOTE_DELETED_PREFIX: "Nota ",
  NOTE_DELETED_SUFFIX: " eliminada.",
  COIN_RESULT_PREFIX: "🪙 Ha salido ",
  DICE_RESULT_PREFIX: "🎲 Has sacado un ",
  EIGHT_BALL_RESULT_PREFIX: "🎱 La bola 8 dice: ",
  UNKNOWN_COMMAND: "Comando no reconocido. Escribe !ayuda para ver los comandos disponibles.",
  HELP_LINES: Object.freeze([
    "Comandos:",
    `${COMMANDS.PING} - Probar el bot`,
    `${COMMANDS.ECHO} <texto> - Repetir texto`,
    `${COMMANDS.ADD_NOTE} <nota> - Guardar una nota`,
    `${COMMANDS.DELETE_NOTE} <índice> - Eliminar una nota`,
    `${COMMANDS.LIST_NOTES} - Mostrar las notas del chat`,
    `${COMMANDS.DICE} - Lanzar un dado`,
    `${COMMANDS.COIN} - Lanzar una moneda`,
    `${COMMANDS.HELP} - Mostrar comandos`,
  ]),
});

module.exports = {
  COIN_SIDES,
  COMMANDS,
  EIGHT_BALL_RESPONSES,
  MESSAGES,
};
