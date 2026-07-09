function createWebhookRuntimeConfig(input = {}) {
  return {
    provider: String(input.provider ?? 'whatsapp-cloud').trim().toLowerCase(),
    channel: String(input.channel ?? 'whatsapp').trim().toLowerCase(),
    exposeErrors: input.exposeErrors === true,
    requireSignature: input.requireSignature !== false,
    whatsappSendEnabled: input.whatsappSendEnabled === true || input.whatsappSendEnabled === 'true',
  };
}

module.exports = { createWebhookRuntimeConfig };
