const AnimalImageApi = require("./animalImageApi");

class TheDogApi extends AnimalImageApi {
  constructor({ apiKey = process.env.THE_DOG_API_KEY, fetchImpl = fetch } = {}) {
    super({
      providerName: "TheDogAPI",
      endpoint: "https://api.thedogapi.com/v1/images/search?limit=1&mime_types=jpg,png",
      apiKey,
      fetchImpl,
    });
  }
}

module.exports = TheDogApi;
