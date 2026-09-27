const { MESSAGES } = require("../commandConstants");
function presentAnimalImageResult(result, animal) { return result.ok ? { ok: true, action: "send_animal_image", imageId: result.data.image.id } : { ok: false, code: result.code, message: animal === 'cat' ? MESSAGES.CAT_UNAVAILABLE : MESSAGES.DOG_UNAVAILABLE }; }
module.exports = { presentAnimalImageResult };
