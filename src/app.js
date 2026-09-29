const { Client, LocalAuth } = require("whatsapp-web.js");
const { generateResponse, generateSummary, shouldAwardFeather, translateTrivia, suggestSimilarCommand, completeToolCall } = require("./ai/muninAI");
const { IMAGE_MIME_TYPE, generateImage } = require("./apis/cloudflareImageApi");
const { createInfrastructure } = require("./bootstrap/createInfrastructure");
const { createServices } = require("./bootstrap/createServices");
const { createHandlers } = require("./bootstrap/createHandlers");
const { MESSAGES } = require("./presenters/messages");

function createMuninApp({ client = new Client({ authStrategy: new LocalAuth(), puppeteer: { headless: false } }), renderQr = console.log } = {}) {
  const infrastructure = createInfrastructure({ client, generateImage, imageMimeType: IMAGE_MIME_TYPE });
  const services = createServices(infrastructure);
  const handlers = createHandlers({
    ai: { completeToolCall, generateResponse, generateSummary, shouldAwardFeather, suggestSimilarCommand, translateTrivia },
    infrastructure,
    services,
  });
  let pendingSchedulerStarted = false;

  function start() {
    infrastructure.schedulers.reminders.start();
    infrastructure.schedulers.classes.start();
    client.on("qr", (qr) => {
      console.log("QR received");
      renderQr(qr);
    });
    client.on("authenticated", () => console.log("AUTHENTICATED"));
    client.on("auth_failure", (message) => console.error("AUTH FAILURE:", message));
    client.on("ready", () => {
      console.log("READY");
      if (!pendingSchedulerStarted) {
        pendingSchedulerStarted = true;
        infrastructure.schedulers.pending.start();
      }
      infrastructure.schedulers.weeklyReports.start();
    });
    client.on("disconnected", (reason) => console.log("DISCONNECTED:", reason));
    client.on("group_join", async ({ chatId }) => {
      try {
        await infrastructure.sendMessage(chatId, MESSAGES.GROUP_JOIN_LANDING);
      } catch (error) {
        console.error("Group join error:", error);
      }
    });
    client.on("message_create", handlers.messageHandler.handleMessageCreate);
    client.initialize();
  }

  return { client, start };
}

module.exports = { createMuninApp };
