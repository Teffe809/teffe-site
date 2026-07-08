function createCapabilitySuccessResponse({ normalizedInput, result, execution, audit }) {
  return {
    ok: true,
    normalizedInput,
    result,
    execution,
    auditId: audit.completed.id,
    audit,
  };
}

function createCapabilityErrorResponse({ normalizedInput, error, audit }) {
  return {
    ok: false,
    normalizedInput,
    error,
    auditId: audit.denied.id,
    audit,
  };
}

module.exports = {
  createCapabilitySuccessResponse,
  createCapabilityErrorResponse,
};
