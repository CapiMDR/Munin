const REQUEST_TIMEOUT_MS = 10_000;

class AnimalImageApi {
  constructor({ providerName, endpoint, apiKey, fetchImpl = fetch }) {
    this.providerName = providerName;
    this.endpoint = endpoint;
    this.apiKey = apiKey?.trim();
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
