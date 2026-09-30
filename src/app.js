const { Client, LocalAuth } = require("whatsapp-web.js");
const { generateResponse, generateSummary, shouldAwardFeather, translateTrivia, suggestSimilarCommand, completeToolCall } = require("./ai/muninAI");
const { IMAGE_MIME_TYPE, generateImage } = require("./apis/cloudflareImageApi");
const { createInfrastructure } = require("./bootstrap/createInfrastructure");
const { createServices } = require("./bootstrap/createServices");
const { createHandlers } = require("./bootstrap/createHandlers");
const { MESSAGES } = require("./presenters/messages");

function createMuninApp({
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: false },
  }),
  renderQr = console.log,
} = {}) {
  const infrastructure = createInfrastructure({
    client,
    generateImage,
    imageMimeType: IMAGE_MIME_TYPE,
  });

  const services = createServices(infrastructure);

  const handlers = createHandlers({
    ai: {
      completeToolCall,
      generateResponse,
      generateSummary,
      shouldAwardFeather,
      suggestSimilarCommand,
      translateTrivia,
    },
    infrastructure,
    services,
  });

  let schedulersStarted = false;
  let ready = false;
  let readinessWatchdog;
  let diagnosticsAttached = false;
  let authenticatedAt = null;

  function attachStartupDiagnostics() {
    if (diagnosticsAttached) return;
    diagnosticsAttached = true;

    const page = client.pupPage;
    const browser = client.pupBrowser;

    if (!page || !browser) {
      console.warn("Could not attach WhatsApp startup diagnostics: Puppeteer is unavailable.");
      return;
    }

    page.on("error", (error) => console.error("WhatsApp Web page crashed:", error));

    page.on("pageerror", (error) => console.error("WhatsApp Web page error:", error));

    page.on("close", () => console.error("WhatsApp Web page closed before readiness."));

    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        console.log("WhatsApp Web navigated:", frame.url());
      }
    });

    browser.on("disconnected", () => console.error("WhatsApp Web browser disconnected before readiness."));
  }

  function startReadinessWatchdog() {
    clearTimeout(readinessWatchdog);

    readinessWatchdog = setTimeout(async () => {
      if (ready) return;

      console.warn("Munin is connected but initialization is taking longer than expected.");

      console.log("WhatsApp Web URL:", client.pupPage?.url?.() || "unavailable");

      try {
        console.log("Client state:", await client.getState());
      } catch (error) {
        console.error("Could not get client state:", error);
      }

      try {
        const injectionState = await client.pupPage.evaluate(() => ({
          hasWWebJS: typeof window.WWebJS !== "undefined",
          wwebjsKeys: window.WWebJS ? Object.keys(window.WWebJS).slice(0, 30) : [],
        }));

        console.log("WWebJS injection:", injectionState);
      } catch (error) {
        console.error("Could not inspect WWebJS:", error);
      }
    }, 120_000);
  }

  function start() {
    client.on("loading_screen", (percent, message) => {
      console.log("LOADING:", percent, message);
    });

    client.on("change_state", (state) => {
      console.log("STATE:", state);
    });

    client.on("qr", (qr) => {
      ready = false;

      console.log("QR received");
      renderQr(qr);
    });

    client.on("authenticated", () => {
      ready = false;
      authenticatedAt = Date.now();

      console.log("AUTHENTICATED");

      attachStartupDiagnostics();
      startReadinessWatchdog();
    });

    client.on("auth_failure", (message) => {
      ready = false;
      clearTimeout(readinessWatchdog);

      console.error("AUTH FAILURE:", message);
    });

    client.on("ready", () => {
      ready = true;
      clearTimeout(readinessWatchdog);

      const seconds = authenticatedAt ? ((Date.now() - authenticatedAt) / 1000).toFixed(1) : "?";

      console.log(`READY (${seconds}s after authentication)`);

      if (!schedulersStarted) {
        schedulersStarted = true;

        infrastructure.schedulers.reminders.start();
        infrastructure.schedulers.classes.start();
        infrastructure.schedulers.pending.start();
        infrastructure.schedulers.weeklyReports.start();
        infrastructure.schedulers.events.start();
      }
    });

    client.on("disconnected", (reason) => {
      ready = false;
      authenticatedAt = null;
      clearTimeout(readinessWatchdog);

      console.log("DISCONNECTED:", reason);
    });

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
