const { createExecutionContext } = require('./execution-context');

function createCapabilityRequest({ capability, pluginId, input, context = {}, metadata = {} }) {
  const executionContext = createExecutionContext(context);

  return {
    capability,
    pluginId,
    input,
    context,
    executionContext,
    metadata,
    requestedAt: new Date().toISOString(),
  };
}

module.exports = { createCapabilityRequest };
