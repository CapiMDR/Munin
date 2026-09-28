const { COMMANDS, INFINITE_TOKEN } = require("../config/commandConstants");

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
    `=== Ayuda 1/${HELP_PAGE_COUNT}: General ===`, HELP_SECTION_INDEX, "", "**Hablar con Munin**", "`!munin`  `!ping`  `!echo hola`", "",
    "**Resúmenes**", '> Dime *"Resume los últimos 20 mensajes"*.', "`!resumen 20`", "",
    "**Comandos personalizados**", '> Dime *"Cuando diga saluda, di: Hola, manada"*. Luego !saluda', "`!comando !saludo Hola, manada`", "Consulta o elimina los comandos del grupo: `!comandos`  `!comando - 1`", "",
    "**Mensajes guardados**", '> Responde a un mensaje y dime *"Guarda esto como reglas"*.', "`!guardar reglas`", '> Dime *"Muestrame reglas"*.', "Puedes verlo, listar los títulos o borrarlo `!ver reglas`  `!guardados`  `!borrar 1`", "",
    "Cambia de página con `!ayuda 2`.",
  ].join("\n"),
  [
    `=== Ayuda 2/${HELP_PAGE_COUNT}: Pendientes y recordatorios ===`, HELP_SECTION_INDEX, "", "**Recordatorios**", '> Dime *"Recuérdame pagarle a Juan mañana a las 17:00"*.', "Como comando relativo desde ahora: `!r 1d pagarle a Juan`", "Para repetirlo: `!r 30m x3 tomar agua`  |  Para repetirlo siempre: `!r 30m inf tomar agua`", '> Dime *"Muéstra mis recordatorios"* o *"quita el recordatorio 1 de la lista"*.', "Consulta o elimina recordatorios: `!r`  `!r - 1`", "",
    "**Pendientes**", '> Dime *"Anota comprar hielo como pendiente"*.', "`!p comprar hielo`", "Puedes añadir fecha y hora, o responder a un mensaje: `!p @25/12 10:00 comprar hielo`  `!p`", '> Dime *"Muéstra mis pendientes"* o *"quita el pendiente 1 de la lista"*.', "Consulta o elimina pendientes: `!p`  `!p - 1`",
  ].join("\n"),
  [
    `=== Ayuda 3/${HELP_PAGE_COUNT}: Diversion y herramientas rapidas ===`, HELP_SECTION_INDEX, "", "**Decidir al azar**", '> Dime *"Elige entre pizza y tacos"*.', "`!elige pizza, tacos`", "Lanza una moneda, un dado o consulta la bola 8: `!moneda`  `!dado`  `!bola8`", "",
    "**Trivia**", '> Dime *"Inicia una trivia de 10 preguntas"*.', "`!trivia 10`", "", "**Encuestas**", "`!encuesta ¿Qué cenamos?,Pizza,Tacos`", "Para permitir varias respuestas: `!encuestam Snacks,Papas,Palomitas,Chocolate`", "", '> Dime *"Pon un temporizador de 10 minutos"*.', "**Temporizadores**", "`!tiempo 10m`", "",
    '> Dime *"Dame una foto de un animal"*.', "Manda un gato al grupo: `!gato`", "Manda un perro al grupo: `!perro`", '> Dime *"Dame el pronóstico de hoy"*.', "Consulta el clima de una ubicación y fecha opcional: `!clima`  `!clima San Francisco`  `!clima mañana San Francisco`", "", "**Estadísticas**", "Consulta tus estadísticas o las de alguien: `!stats`  `!stats @usuario`", "Consulta el reporte semanal del grupo: `!reporte`", "Activa o desactiva el reporte automático semanal: `!usarreporte`",
  ].join("\n"),
  [
    `=== Ayuda 4/${HELP_PAGE_COUNT}: Clases ===`, HELP_SECTION_INDEX, "", '> Dime *"Muéstrame mis clases de hoy"*.', '> Dime *"Muéstrame mi horario"*.', "Consulta la clase actual o siguiente, las de hoy, o toda la semana: `!clase`  `!clases`  `!todaslasclases`", "", "**Agregar una clase**", '> Dime *"Agrega Matemáticas el lunes de 8 a 9:30 en A-301"*.', "`!agregarclase Matemáticas, lunes, 08:00-09:30, A-301`", "", "**Editar o eliminar**", "Usa el nombre o índice de la lista: `!editarclase 2, horario=10:00-11:30`  `!eliminarclase 2`", "", '> Dime *"Apaga/enciende la campana"*.', "**Campana de clases**", "Activa o desactiva el aviso de 10 minutos antes de cada clase: `!campana`",
  ].join("\n"),
  [
    `=== Ayuda 5/${HELP_PAGE_COUNT}: Administracion ===`, HELP_SECTION_INDEX, "", "**Bloqueos**", "Bloquea temporalmente a alguien o retíralos: `!ban @usuario 1h` `!unban @usuario`", `Para un bloqueo indefinido usa: \`!ban @usuario ${INFINITE_TOKEN}\``, "Consulta la lista de usuarios bloqueados y administradores: `!config`", "", "**Administradores**", "Da o quita permisos de administrador: `!admin @usuario`  `!noadmin @usuario`", "", "**Pausar Munin**", `Pausa respuestas en este grupo: \`!pausa 30m\`  |  Indefinidamente: \`!pausa ${INFINITE_TOKEN}\``, "Reanuda respuestas: `!despausa`",
  ].join("\n"),
  [
    `=== Ayuda 6/${HELP_PAGE_COUNT}: Plumas del cuervo ===`, HELP_SECTION_INDEX, "", `> "De vez en cuando encuentro un mensaje que merece algo más que una respuesta.`, "> Puede ser particularmente gracioso, ingenioso, interesante o simplemente demasiado bueno para dejarlo pasar.", "> Cuando eso ocurre, dejo una pluma 🪶.", "> No puedes pedirlas. No puedes darlas. Y no prometo ser justo.", `> Si tienes una, es porque algo que dijiste le gustó mucho a un cuervo." - 🐦‍⬛`,
  ].join("\n"),
]);

function getHelpPage(page) {
  return HELP_PAGES[page - 1];
}

function getHelpPageUsage() {
  return `Uso: ${COMMANDS.HELP} <página del 1 al ${HELP_PAGE_COUNT}>`;
}

module.exports = { getHelpPage, getHelpPageUsage };
