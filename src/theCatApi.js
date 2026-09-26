const AnimalImageApi = require("./animalImageApi");

class TheCatApi extends AnimalImageApi {
  constructor({ apiKey = process.env.THE_CAT_API_KEY, fetchImpl = fetch } = {}) {
    super({
      providerName: "TheCatAPI",
      endpoint: "https://api.thecatapi.com/v1/images/search?limit=1&mime_types=jpg,png",
      apiKey,
      fetchImpl,
    });
  }
}

module.exports = TheCatApi;
