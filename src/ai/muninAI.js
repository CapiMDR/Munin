const Groq = require("groq-sdk");
const fs = require("fs");
const path = require("path");
const { TOOLS } = require("./aiTools");
const { createTriviaTranslator } = require("./triviaTranslator");
const { createConversationStore } = require("./conversationStore");
const { createAiUtilityService } = require("./aiUtilityService");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MAX_HISTORY = 20;

// Models are tried in this order.
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "openai/gpt-oss-safeguard-20b"];

const conversationStore = createConversationStore(MAX_HISTORY);

const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, "..", "prompts", "munin-system-prompt.md"), "utf8").trim();

function buildSystemPrompt() {
  const currentMexicoCityTime = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "full",
    timeStyle: "medium",
    hourCycle: "h23",
  }).format(new Date());

  return `${SYSTEM_PROMPT}\nHora actual en Ciudad de Mexico: ${currentMexicoCityTime}. Los recordatorios relativos se calculan desde el momento en que se crea el recordatorio.`;
}

async function createCompletion(messages, useTools = true) {
  let lastError;

  for (const model of MODELS) {
    try {
      console.log(`Trying model: ${model}`);

      const options = {
        model,
        messages,
      };

      if (useTools) {
        options.tools = TOOLS;
        options.tool_choice = "auto";
      }

      const completion = await groq.chat.completions.create(options);

      console.log(`Model used: ${model}`);

      return {
        completion,
        model,
      };
    } catch (error) {
      lastError = error;

      if (error.status === 429) {
        console.warn(`${model} hit a rate/quota limit. Trying next model...`);

        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

async function generateResponse(chatId, senderName, message) {
  const history = conversationStore.get(chatId);

  const userMessage = {
    role: "user",
    content: `[${senderName}]: ${message}`,
  };

  const messages = [
    {
      role: "system",
      content: buildSystemPrompt(),
    },
    ...history,
    userMessage,
  ];

  const { completion, model } = await createCompletion(messages);

  const assistantMessage = completion.choices[0]?.message;

  if (!assistantMessage) {
    return undefined;
  }

  // The model wants Munin to perform an action.
  if (assistantMessage.tool_calls?.length) {
    return {
      type: "tool_call",
      toolCall: assistantMessage.tool_calls[0],
      messages,
      assistantMessage,
      userMessage,
      model,
    };
  }

  // Normal conversation.
  const response = assistantMessage.content;

  if (!response) {
    return undefined;
  }

  history.push(userMessage);

  history.push({
    role: "assistant",
    content: response,
  });

  conversationStore.trim(history);

  return {
    type: "message",
    content: response,
  };
}

// Translates an entire trivia batch in a single model request. The result keeps
// Open Trivia DB's response shape so later round-handling can use every question.
const { translateTrivia } = createTriviaTranslator({ complete: (messages, options) => createCompletion(messages, options?.useTools) });
const { generateSummary, shouldAwardFeather, suggestSimilarCommand } = createAiUtilityService({
  complete: (messages, options) => createCompletion(messages, options?.useTools),
});

async function completeToolCall(chatId, toolCall, toolResult, messages, assistantMessage, userMessage) {
  const history = conversationStore.get(chatId);

  const toolMessages = [
    ...messages,

    // Important: include the assistant message that
    // requested the tool.
    assistantMessage,

    // Then provide the result of that tool.
    {
      role: "tool",
      tool_call_id: toolCall.id,
      name: toolCall.function.name,
      content: JSON.stringify(toolResult),
    },
  ];

  const { completion, model } = await createCompletion(toolMessages, false);

  const response = completion.choices[0]?.message?.content;

  if (!response) {
    return undefined;
  }

  // Store the original user request and Munin's
  // final conversational response.
  history.push(userMessage);

  history.push({
    role: "assistant",
    content: response,
  });

  conversationStore.trim(history);

  return response;
}

module.exports = {
  generateResponse,
  generateSummary,
  shouldAwardFeather,
  translateTrivia,
  suggestSimilarCommand,
  completeToolCall,
};
