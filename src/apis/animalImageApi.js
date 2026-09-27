const REQUEST_TIMEOUT_MS = 10_000;

const ANIMAL_PROVIDERS = Object.freeze({
  cat: {
    providerName: "TheCatAPI",
    endpoint: "https://api.thecatapi.com/v1/images/search?limit=1&mime_types=jpg,png",
    apiKey: () => process.env.THE_CAT_API_KEY,
  },
  dog: {
    providerName: "TheDogAPI",
    endpoint: "https://api.thedogapi.com/v1/images/search?limit=1&mime_types=jpg,png",
    apiKey: () => process.env.THE_DOG_API_KEY,
  },
});

class AnimalImageApi {
  constructor(animal, { apiKey, fetchImpl = fetch } = {}) {
    const provider = ANIMAL_PROVIDERS[animal];
    if (!provider) throw new Error(`Unsupported animal image provider: ${animal}`);
    const resolvedApiKey = apiKey ?? provider.apiKey();
    const { providerName, endpoint } = provider;
    this.providerName = providerName;
    this.endpoint = endpoint;
    this.apiKey = resolvedApiKey?.trim();
    this.fetch = fetchImpl;
  }

  async getRandomImage() {
    if (!this.apiKey) throw new Error(`${this.providerName} API key is not configured.`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetch(this.endpoint, {
        headers: { "x-api-key": this.apiKey },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`${this.providerName} responded with ${response.status}.`);

      const image = (await response.json())?.[0];
      if (!image?.url || !isSafeImageUrl(image.url)) throw new Error(`${this.providerName} returned no usable image.`);
      return { id: image.id, url: image.url };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function isSafeImageUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

module.exports = AnimalImageApi;
