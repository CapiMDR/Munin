const { failure, success } = require("./result");
async function sendAnimalImage({ chatId, animal }, sendImage) {
  if (!['cat', 'dog'].includes(animal) || typeof sendImage !== 'function') return failure('ANIMAL_IMAGE_UNAVAILABLE');
  try { return success('ANIMAL_IMAGE_SENT', { image: await sendImage(chatId, animal), animal }); }
  catch (error) { console.error(`Could not send ${animal} image:`, error.message); return failure('ANIMAL_IMAGE_UNAVAILABLE'); }
}
module.exports = { sendAnimalImage };
