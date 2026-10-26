const { isImage } = require("../../utils/messageUtils");

const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_REQUEST_BYTES = 20 * 1024 * 1024;

async function getImageDataUrl(message) {
  const imageMessage = isImage(message);
  console.log("Vision input received:", {
    type: message?.type || message?._data?.type,
    isImage: imageMessage,
    hasMedia: Boolean(message?.hasMedia),
    canDownloadMedia: typeof message?.downloadMedia === "function",
  });
  if (!imageMessage) return undefined;
  if (typeof message?.downloadMedia !== "function") throw new Error("The attached image cannot be downloaded.");

  const media = await message.downloadMedia();
  console.log("Vision media download result:", {
    received: Boolean(media),
    mimeType: media?.mimetype,
    hasData: Boolean(media?.data),
  });
  if (!media?.data || !SUPPORTED_IMAGE_MIME_TYPES.has(media.mimetype)) {
    throw new Error("The attached image format is unsupported.");
  }

  const dataUrl = `data:${media.mimetype};base64,${media.data}`;
  const requestBytes = Buffer.byteLength(dataUrl);
  console.log("Vision image prepared:", { mimeType: media.mimetype, requestBytes });
  if (requestBytes > MAX_IMAGE_REQUEST_BYTES) {
    throw new Error("The attached image exceeds the 20 MB vision limit.");
  }

  return dataUrl;
}

module.exports = { getImageDataUrl };

