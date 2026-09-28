const MODEL = "@cf/black-forest-labs/flux-1-schnell";
const IMAGE_MIME_TYPE = "image/jpeg";

async function generateImage(prompt, { accountId = process.env.CLOUDFLARE_ACCOUNT_ID, apiToken = process.env.CLOUDFLARE_API_TOKEN, fetchImpl = fetch } = {}) {
  const normalizedPrompt = typeof prompt === "string" ? prompt.trim() : "";
  if (!normalizedPrompt || normalizedPrompt.length > 2_048) throw new Error("Image prompt must contain between 1 and 2048 characters.");
  if (!accountId || !apiToken) throw new Error("Cloudflare image generation is not configured.");

  const response = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: normalizedPrompt,
      steps: 4,
    }),
  });

  if (!response.ok) {
    const error = await response.text();

    throw new Error(`Cloudflare image generation failed (${response.status}): ${error}`);
  }

  const data = await response.json();

  if (!data.result?.image) {
    throw new Error("Cloudflare did not return an image.");
  }

  return Buffer.from(data.result.image.replace(/^data:image\/[a-z+.-]+;base64,/, ""), "base64");
}

module.exports = {
  IMAGE_MIME_TYPE,
  generateImage,
};
