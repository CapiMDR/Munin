function createTriviaTranslator({ complete }) {
  async function translateTrivia(trivia) {
    const messages = [
      {
        role: "system",
        content:
          "Translate every human-readable string in the supplied Open Trivia DB JSON to natural Mexican Spanish. Return only valid JSON, with exactly the same object shape and keys: response_code and results; each result must retain category, type, difficulty, question, correct_answer, and incorrect_answers. Keep response_code as 0, retain every result and answer, and never reveal which answer is correct outside the correct_answer field.",
      },
      { role: "user", content: JSON.stringify(trivia) },
    ];
    const { completion } = await complete(messages, { useTools: false });
    const translated = parseTranslatedTrivia(completion.choices[0]?.message?.content, trivia?.results?.length);
    if (!translated) throw new Error("The trivia translation was invalid.");
    return translated;
  }
  return { translateTrivia };
}

function parseTranslatedTrivia(content, expectedQuestionCount) {
  if (typeof content !== "string") return undefined;
  try {
    const trivia = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
    if (trivia?.response_code !== 0 || !Array.isArray(trivia.results) || trivia.results.length !== expectedQuestionCount) return undefined;
    return trivia.results.every(isTranslatedTriviaQuestion) ? trivia : undefined;
  } catch {
    return undefined;
  }
}

function isTranslatedTriviaQuestion(question) {
  return (
    typeof question?.category === "string" &&
    typeof question.question === "string" &&
    typeof question.correct_answer === "string" &&
    Array.isArray(question.incorrect_answers) &&
    question.incorrect_answers.every((answer) => typeof answer === "string")
  );
}

module.exports = { createTriviaTranslator, parseTranslatedTrivia };
