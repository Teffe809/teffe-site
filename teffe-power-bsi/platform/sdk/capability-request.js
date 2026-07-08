function createCapabilityRequest({ capability, pluginId, input, context = {}, metadata = {} }) {
  return {
    capability,
    pluginId,
    input,
    context,
    metadata,
    requestedAt: new Date().toISOString(),
  };
}

module.exports = { createCapabilityRequest };
