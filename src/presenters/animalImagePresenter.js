const CAT_UNAVAILABLE = "No pude encontrar un gato ahora. Inténtalo de nuevo más tarde.";
const DOG_UNAVAILABLE = "No pude encontrar un perro ahora. Inténtalo de nuevo más tarde.";

function presentAnimalImageResult(result, animal) {
  return result.ok
    ? { ok: true, action: "send_animal_image", imageId: result.data.image.id }
    : { ok: false, code: result.code, message: animal === "cat" ? CAT_UNAVAILABLE : DOG_UNAVAILABLE };
}

module.exports = { CAT_UNAVAILABLE, DOG_UNAVAILABLE, presentAnimalImageResult };
