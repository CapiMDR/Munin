const { MessageMedia, Poll } = require("whatsapp-web.js");

function createWhatsAppOutput({ animalImageApis, client, generateImage, imageMimeType }) {
  async function deliver(output) {
    if (!output?.type) throw new Error("An output DTO type is required.");

    switch (output.type) {
      case "text":
        return client.sendMessage(output.chatId, output.text, output.options);
      case "reaction":
        return client.sendReaction(output.messageId, output.emoji);
      case "poll":
        return client.sendMessage(output.chatId, new Poll(output.title, output.options, { allowMultipleAnswers: output.allowMultipleAnswers }));
      case "media":
        return client.sendMessage(output.chatId, output.media);
      case "animal_image":
        return deliverAnimalImage(output.chatId, output.animal);
      case "generated_image":
        return deliverGeneratedImage(output.chatId, output.prompt);
      default:
        throw new Error(`Unsupported output DTO type: ${output.type}`);
    }
  }

  async function deliverAnimalImage(chatId, animal) {
    const animalApi = animalImageApis[animal];
    if (!animalApi) throw new Error(`Unsupported animal: ${animal}`);

    const image = await animalApi.getRandomImage();
    const media = await MessageMedia.fromUrl(image.url, { unsafeMime: true });
    await deliver({ type: "media", chatId, media });
    return image;
  }

  async function deliverGeneratedImage(chatId, prompt) {
    const image = await generateImage(prompt);
    const media = new MessageMedia(imageMimeType, image.toString("base64"), "munin.jpg");
    await deliver({ type: "media", chatId, media });
  }

  return { deliver };
}

module.exports = { createWhatsAppOutput };
