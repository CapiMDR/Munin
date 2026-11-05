const fs = require("fs");
const path = require("path");
const { DEFAULT_BOT_TIME } = require("../config/settings");
const systemPrompt = fs.readFileSync(path.join(__dirname, "..", "prompts", "munin-system-prompt.md"), "utf8").trim();
function buildSystemPrompt(now = new Date()) {
  const time = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", dateStyle: "full", timeStyle: "medium", hourCycle: "h23" }).format(
    now,
  );
  return `${systemPrompt}\nHora actual en Ciudad de Mexico: ${time}. La hora predeterminada del bot es ${DEFAULT_BOT_TIME}. Cuando el usuario solicite un recordatorio para una fecha sin indicar hora, menciona que se programará a esa hora. Los recordatorios relativos se calculan desde el momento en que se crea el recordatorio.`;
}
module.exports = { buildSystemPrompt };
