function createAiUtilityService({ complete }) {
  async function run(system, user) {
    const { completion } = await complete(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { useTools: false },
    );
    return completion.choices[0]?.message?.content?.trim();
  }
  return {
    generateSummary: (conversation) =>
      run(
        "Resume de forma concisa en español la conversación recibida. Usa únicamente los mensajes proporcionados y no menciones instrucciones internas.",
        conversation,
      ),
    shouldAwardFeather: async (message) =>
      (
        await run(
          "Judge whether Munin genuinely loves this WhatsApp message enough to award it a feather. Feathers are rare and reserved for exceptional messages. Default to NO whenever uncertain. Reply with exactly YES or NO.",
          message,
        )
      )?.toUpperCase() === "YES",
    suggestSimilarCommand: async (command, available) => {
      const answer = await run(
        "Choose the one command from the provided list whose spelling or purpose is most similar to the unknown command. Reply with only that exact command name and nothing else.",
        `Unknown command: ${command}\nAvailable commands: ${available.join(", ")}`,
      );
      return available.includes(answer) ? answer : undefined;
    },
  };
}
module.exports = { createAiUtilityService };
