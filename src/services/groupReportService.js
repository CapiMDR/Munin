const STICKER_THRESHOLD = 30;
const STICKER_PROPORTION_THRESHOLD = 0.3;
const MUNIN_MENTIONS_THRESHOLD = 30;
const PENDING_THRESHOLD = 5;
const REMINDER_THRESHOLD = 4;
const POLL_THRESHOLD = 3;
const LOW_MESSAGE_THRESHOLD = 15;
const TRIVIA_PARTICIPATION_THRESHOLD = 6;
const TRIVIA_ANSWER_THRESHOLD = 8;
const TRIVIA_HIGH_ACCURACY_THRESHOLD = 0.75;
const TRIVIA_LOW_ACCURACY_THRESHOLD = 0.3;
const TRIVIA_WINS_THRESHOLD = 2;

function getWeeklyReportComment(weekly, leaders, currentPendings) {
  let observations = "";
  const trivia = weekly.trivia || {};

  if (weekly.stickers > STICKER_THRESHOLD) {
    observations += `El cuervo concluye que ${leaders.stickers.names.join(", ")} ya domina el idioma de los stickers.\n`;
  }

  if (weekly.stickers > weekly.messages * STICKER_PROPORTION_THRESHOLD) {
    observations += "Una parte preocupante de esta conversación fueron stickers.\n";
  }

  if (weekly.muninMentions > MUNIN_MENTIONS_THRESHOLD) {
    observations += `Me invocaron ${weekly.muninMentions} veces. Empiezo a creer que el grupo depende de mí.\n`;
  }

  if (currentPendings >= PENDING_THRESHOLD) {
    observations += `Hay ${currentPendings} pendientes abiertos. Este grupo siempre está ocupado.\n`;
  }

  if (weekly.remindersCreated >= REMINDER_THRESHOLD) {
    observations += `Crearon ${weekly.remindersCreated} recordatorios. A este grupo siempre se le olvida todo.\n`;
  }

  if (weekly.pollsCreated >= POLL_THRESHOLD) {
    observations += `Hicieron ${weekly.pollsCreated} encuestas. Son muy indecisos todos.\n`;
  }

  if ((trivia.gamesPlayed || 0) >= TRIVIA_PARTICIPATION_THRESHOLD) {
    observations += `Acumularon ${trivia.gamesPlayed} participaciones en trivia. El cuervo ya sospecha que estudian a escondidas.\n`;
  }

  if ((trivia.gamesWon || 0) >= TRIVIA_WINS_THRESHOLD) {
    observations += `${leaders.trivia.gamesWon.names.join(", ")} está dominando las trivias con ${leaders.trivia.gamesWon.value} victorias.\n`;
  }

  const triviaAccuracy = (trivia.correctAnswers || 0) / (trivia.questionsAnswered || 1);
  if ((trivia.questionsAnswered || 0) >= TRIVIA_ANSWER_THRESHOLD && triviaAccuracy >= TRIVIA_HIGH_ACCURACY_THRESHOLD) {
    observations += `Con ${Math.round(triviaAccuracy * 100)}% de respuestas correctas, este grupo ya está listo para pelear contra Odín en una trivia.\n`;
  } else if ((trivia.questionsAnswered || 0) >= TRIVIA_ANSWER_THRESHOLD && triviaAccuracy <= TRIVIA_LOW_ACCURACY_THRESHOLD) {
    observations += `Solo acertaron ${Math.round(triviaAccuracy * 100)}% de las preguntas de trivia. El cuervo recomienda abrir un libro de vez en cuando.\n`;
  }

  if (weekly.messages < LOW_MESSAGE_THRESHOLD) {
    observations += "El grupo ahora está en Valhalla (muerto).\n";
  }

  observations += `El cuervo archivó ${weekly.messages} mensajes esta semana y aún conserva algunas plumas.\nSeguiré observando...`;
  return observations;
}

function getWeeklyStatLeaders(members) {
  const metrics = [
    "messages",
    "nightMessages",
    "repliesSent",
    "mentionsSent",
    "mentionsReceived",
    "muninMentions",
    "stickers",
    "images",
    "voiceNotes",
    "feathers",
    "words",
    "commandsUsed",
    "remindersCreated",
    "messagesSaved",
    "pollsCreated",
  ];

  return {
    ...Object.fromEntries(metrics.map((metric) => [metric, getWeeklyStatLeader(members, metric)])),
    trivia: {
      gamesWon: getWeeklyTriviaLeader(members, "gamesWon"),
      correctAnswers: getWeeklyTriviaLeader(members, "correctAnswers"),
    },
  };
}

function getWeeklyStatLeader(members, metric) {
  const value = Math.max(0, ...members.map((member) => member.weekly?.[metric] || 0));
  return {
    value,
    names: value ? members.filter((member) => (member.weekly?.[metric] || 0) === value).map((member) => member.name) : [],
  };
}

function getWeeklyTriviaLeader(members, metric) {
  const value = Math.max(0, ...members.map((member) => member.weekly?.trivia?.[metric] || 0));
  return {
    value,
    names: value ? members.filter((member) => (member.weekly?.trivia?.[metric] || 0) === value).map((member) => member.name) : [],
  };
}

module.exports = { getWeeklyReportComment, getWeeklyStatLeaders };
