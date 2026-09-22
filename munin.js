const { Client, LocalAuth } = require("whatsapp-web.js");
const CommandHandler = require("./commandHandler");

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:");
  console.error(reason);
});

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:");
  console.error(error);
});

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: false,
  },
});

const commandHandler = new CommandHandler(client);

client.on("qr", (qr) => {
  console.log("QR received");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("AUTHENTICATED");
});

client.on("auth_failure", (msg) => {
  console.error("AUTH FAILURE:", msg);
});

client.on("ready", () => {
  console.log("READY");
});

client.on("disconnected", (reason) => {
  console.log("DISCONNECTED:", reason);
});

client.on("message_create", async (message) => {
  try {
    const chatId = message.id.remote;

    // Ignore anything that isn't a group
    if (!chatId?.endsWith("@g.us")) return;

    // Ignore non-command messages
    if (!message.body.startsWith("!")) return;

    await commandHandler.handleCommand(message, chatId);
  } catch (error) {
    console.error("Message handler error:", error);
  }
});

client.initialize();
