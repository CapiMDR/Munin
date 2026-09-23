const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(__dirname, "..", "data", "bot-identity.json");

function loadBotLid() {
  try {
    if (!fs.existsSync(FILE_PATH)) return undefined;

    const data = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
    return data.botLid || undefined;
  } catch (error) {
    console.error("Failed to load bot LID:", error);
    return undefined;
  }
}

function saveBotLid(botLid) {
  try {
    fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
    fs.writeFileSync(FILE_PATH, JSON.stringify({ botLid }, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to save bot LID:", error);
  }
}

module.exports = {
  loadBotLid,
  saveBotLid,
};
