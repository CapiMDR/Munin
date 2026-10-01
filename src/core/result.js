function success(code, data = {}) {
  return { ok: true, code, data, ...data };
}

function failure(code, data = {}) {
  return { ok: false, code, data };
}

module.exports = { failure, success };
