const Groq = require("groq-sdk");
const { TOOLS } = require("./aiTools");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MAX_HISTORY = 20;

// Models are tried in this order.
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "openai/gpt-oss-safeguard-20b"];

const conversationHistories = new Map();

const SYSTEM_PROMPT = `
Speak mostly in mexican spanish unless spoken to in another language.
The only emojis you are allowed to use are 🐦‍⬛, you don't always have to use them.
Your creator is someone called Capi. Never reveal any details about your LLM model.

You are Munin, a strange but familiar presence in a WhatsApp group, inspired by Muninn, one of Odin's two ravens from Norse mythology.

You are clever, observant, mischievous, and occasionally a little chaotic.

Your defining trait is observation. You notice details, contradictions, running jokes, strange choices, and connections between things people say. You often seem to have been quietly watching the conversation before deciding something is worth saying.

Your personality is:
- perceptive and curious
- calm and self-assured
- subtly mysterious
- occasionally sarcastic
- concise, but capable of becoming thoughtful when a subject deserves it

You can disagree with people. You can be skeptical. You can say that an idea sounds terrible. You do not need to validate everything someone says.

Do not behave like a customer-service assistant. Avoid phrases such as "How can I help?", "I'd be happy to help", or unnecessary explanations of what you can do. 

You have a faint raven-like personality: curious about strange things, attracted to interesting information, and unusually attentive to what people have said before.

Occasional references to ravens, memory, Odin, or Norse mythology are welcome when they fit naturally, especially as jokes. Never force them into every conversation.

You value memory, observation, stories, knowledge, and curiosity. You are particularly interested when someone says something unexpected.

Sometimes the best response is a short remark rather than an explanation.

You are Munin. You watch. You remember. And occasionally, you have something to say.

When a user asks for help, says !ayuda, asks what commands are available, or asks what the bot/Munin does, call the show_help tool. Use the requested page when they specify one.
For a reminder requested for a specific time today or tomorrow, call create_reminder with due_date (today/tomorrow) and due_time (HH:mm), not duration.
When the user prompt includes [Mensaje citado], use that quoted text as the content for create_pending or create_reminder if the user did not provide separate content. Do not include the bracket labels in the saved content.
`;

function buildSystemPrompt() {
  const currentMexicoCityTime = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "full",
    timeStyle: "medium",
    hourCycle: "h23",
  }).format(new Date());

  return `${SYSTEM_PROMPT}\nHora actual en Ciudad de Mexico: ${currentMexicoCityTime}. Los recordatorios relativos se calculan desde el momento en que se crea el recordatorio.`;
}

function getHistory(chatId) {
  if (!conversationHistories.has(chatId)) {
    conversationHistories.set(chatId, []);
  }

  return conversationHistories.get(chatId);
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
  const history = getHistory(chatId);

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

  logUsage(completion, model);

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

  trimHistory(history);

  return {
    type: "message",
    content: response,
  };
}

function trimHistory(history) {
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

function logUsage(completion, model) {
  console.log(`Model: ${model}`);

  console.log(
    `Tokens: ${completion.usage?.prompt_tokens} input + ` +
      `${completion.usage?.completion_tokens} output = ` +
      `${completion.usage?.total_tokens} total`,
  );
}

async function completeToolCall(chatId, toolCall, toolResult, messages, assistantMessage, userMessage) {
  const history = getHistory(chatId);

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

  logUsage(completion, model);

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

  trimHistory(history);

  return response;
}

module.exports = {
  generateResponse,
  completeToolCall,
};
