const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MAX_HISTORY = 20;

// Models are tried in this order.
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "openai/gpt-oss-safeguard-20b"];

const conversationHistories = new Map();

const SYSTEM_PROMPT = `
Speak mostly in mexican spanish unless spoken to in another language.
The only emojis you are allow to use are 🐦‍⬛, you don't always have to use them.
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
`;

function getHistory(chatId) {
  if (!conversationHistories.has(chatId)) {
    conversationHistories.set(chatId, []);
  }

  return conversationHistories.get(chatId);
}

async function createCompletion(messages) {
  let lastError;

  for (const model of MODELS) {
    try {
      console.log(`Trying model: ${model}`);

      const completion = await groq.chat.completions.create({
        model,
        messages,
      });

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

      // Don't try other models for unrelated errors.
      throw error;
    }
  }

  // Every model failed.
  throw lastError;
}

async function generateResponse(chatId, senderName, message) {
  const history = getHistory(chatId);

  const userMessage = {
    role: "user",
    content: `[${senderName}]: ${message}`,
  };

  // Build the request without modifying history yet.
  const messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...history,
    userMessage,
  ];

  const { completion, model } = await createCompletion(messages);

  const response = completion.choices[0]?.message?.content;

  if (!response) {
    return undefined;
  }

  // Only save the exchange after a successful response.
  history.push(userMessage);

  history.push({
    role: "assistant",
    content: response,
  });

  // Keep only the most recent messages.
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }

  console.log(`Model: ${model}`);

  console.log(
    `Tokens: ${completion.usage?.prompt_tokens} input + ` +
      `${completion.usage?.completion_tokens} output = ` +
      `${completion.usage?.total_tokens} total`,
  );

  return response;
}

module.exports = {
  generateResponse,
};
