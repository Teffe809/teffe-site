const { createExecutionContext } = require('./execution-context');

function createCapabilityRequest({
  capability,
  pluginId,
  input,
  context = {},
  metadata = {},
  inputContract = null,
  resultContract = null,
  requirements = [],
}) {
  const executionContext = createExecutionContext(context);

  return {
    capability,
    pluginId,
    input,
    context,
    executionContext,
    metadata,
    requirements,
    contracts: {
      input: inputContract,
      result: resultContract,
    },
    requestedAt: new Date().toISOString(),
  };
}

module.exports = { createCapabilityRequest };
