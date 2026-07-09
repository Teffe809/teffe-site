function createWhatsAppCloudFeatureFlags(input = {}) {
  return {
    sendEnabled: input.sendEnabled === true || input.sendEnabled === 'true',
    sandboxMode: input.sandboxMode !== false,
  };
}

module.exports = { createWhatsAppCloudFeatureFlags };
