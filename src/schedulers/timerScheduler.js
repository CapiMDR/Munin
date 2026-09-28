function scheduleTimer(duration, callback) {
  return setTimeout(() => {
    Promise.resolve()
      .then(callback)
      .catch((error) => console.error("Could not deliver timer:", error));
  }, duration);
}

module.exports = { scheduleTimer };
