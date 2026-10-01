const { COMMANDS } = require("../../config/commandConstants");

const TRIVIA_USAGE = `Uso: ${COMMANDS.TRIVIA} <número de preguntas entre 1 y 50>`;
const TRIVIA_UNAVAILABLE = "No pude conseguir preguntas de trivia ahora. Inténtalo de nuevo más tarde.";

function presentTriviaResult(result) {
  if (result.ok) return { ok: true, action: "start_trivia" };
  return { ok: false, code: result.code, message: result.code === "TRIVIA_AMOUNT_INVALID" ? TRIVIA_USAGE : TRIVIA_UNAVAILABLE };
}

function presentTriviaStarting(seconds) {
  return `🧠 La trivia comienza en ${seconds} segundos, contesten con A, B, C o D. No es necesario mencionarme para contestar, reaccionaré con "🐦‍⬛" cuando vea tu respuesta. ¡Que gane aquel con la mejor memoria!`;
}

function presentTriviaAlreadyActive() {
  return "Ya hay una trivia en curso en este grupo. Terminen esa antes de empezar otra.";
}

function presentTriviaQuestion(trivia) {
  const question = trivia?.results?.[0];
  if (!question) return TRIVIA_UNAVAILABLE;
  const answers = shuffleTriviaAnswers([question.correct_answer, ...question.incorrect_answers]);
  return [
    "🧠 Trivia",
    `Pregunta 1 de ${trivia.results.length} · ${question.category}`,
    "",
    `*${question.question}*`,
    "",
    ...answers.map((answer, index) => `${String.fromCharCode(65 + index)}. ${answer}`),
  ].join("\n");
}

function presentTriviaSessionQuestion(question, number, total, durationSeconds) {
  return [
    "🧠 Trivia",
    `Pregunta ${number} de ${total} · ${question.category}`,
    "",
    `*${question.question}*`,
    "",
    ...question.options.map((option) => `${option.letter}. ${option.text}`),
    "",
    `Tienen ${durationSeconds} segundos para responder con A, B, C o D.`,
  ].join("\n");
}

function presentTriviaAnswerReveal(question, correctPlayers) {
  return [
    "⏰ Tiempo",
    `La respuesta era *${question.correctOption}. ${question.options.find((option) => option.letter === question.correctOption)?.text}*`,
    correctPlayers.length ? `Acertaron (${correctPlayers.length}): ${correctPlayers.join(", ")}` : "Nadie acertó esta vez.",
  ].join("\n");
}

function presentTriviaScoreboard(ranking) {
  return formatTriviaRanking("📊 Marcador", ranking);
}

function presentTriviaLeaderboard(ranking) {
  return `${formatTriviaRanking("🏆 Trivia terminada", ranking)}\nYa he visto suficiente conocimiento.`;
}

function formatTriviaRanking(title, ranking) {
  if (!ranking.length) return `${title}\n\nNadie respondió la trivia.`;
  return [
    title,
    "",
    ...ranking.map((player, index) => `${index + 1}. ${player.name} — ${player.score} ${player.score === 1 ? "punto" : "puntos"}`),
  ].join("\n");
}

function shuffleTriviaAnswers(answers) {
  const shuffled = [...answers];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
  }
  return shuffled;
}

module.exports = {
  formatTriviaRanking,
  presentTriviaAlreadyActive,
  presentTriviaAnswerReveal,
  presentTriviaLeaderboard,
  presentTriviaQuestion,
  presentTriviaResult,
  presentTriviaScoreboard,
  presentTriviaSessionQuestion,
  presentTriviaStarting,
};
