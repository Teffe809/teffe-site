const { createExecutionContext } = require('./execution-context');

function createCapabilityRequest({
  capability,
  pluginId,
  input,
  context = {},
  metadata = {},
  inputContract = null,
  resultContract = null,
}) {
  const executionContext = createExecutionContext(context);

  return {
    capability,
    pluginId,
    input,
    context,
    executionContext,
    metadata,
    contracts: {
      input: inputContract,
      result: resultContract,
    },
    requestedAt: new Date().toISOString(),
  };
}

module.exports = { createCapabilityRequest };
