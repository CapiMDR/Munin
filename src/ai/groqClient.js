const Groq = require("groq-sdk");
function createGroqClient({ apiKey = process.env.GROQ_API_KEY, models, tools, client } = {}) {
  const resolvedClient = client || new Groq({ apiKey });

  async function complete(messages, { useTools = true, toolChoice = "auto", temperature } = {}) {
    let lastError;
    for (const model of models) {
      try {
        const options = { model, messages };
        if (useTools) Object.assign(options, { tools, tool_choice: toolChoice });
        if (temperature !== undefined) options.temperature = temperature;

        console.log(`Trying model: ${model}`);
        const completion = await resolvedClient.chat.completions.create(options);
        logUsage(completion, model);
        return { completion, model };
      } catch (error) {
        lastError = error;
        if (error.status !== 429) throw error;
        console.warn(`${model} hit a rate/quota limit. Trying next model...`);
      }
    }
    throw lastError;
  }
  return { complete };
}
function logUsage(completion, model) {
  console.log(`Model: ${model}`);
  console.log(
    `Tokens: ${completion.usage?.prompt_tokens} input + ${completion.usage?.completion_tokens} output = ${completion.usage?.total_tokens} total`,
  );
}
module.exports = { createGroqClient };
