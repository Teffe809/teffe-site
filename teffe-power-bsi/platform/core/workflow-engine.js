const { CapabilityPipeline, createCapabilityRequest } = require('../sdk');

class WorkflowEngine {
  constructor({
    pluginEngine,
    memoryEngine,
    auditLog,
    securityGuardian,
    capabilityPipeline,
    capabilityRegistry,
  }) {
    this.securityGuardian = securityGuardian;
    this.capabilityRegistry = capabilityRegistry;
    this.capabilityPipeline = capabilityPipeline || new CapabilityPipeline({
      pluginEngine,
      memoryEngine,
      auditLog,
    });
  }

  runVehicleIdentification(input, context = {}) {
    const capabilityId = 'vehicle-identification.manual';
    const capability = this.capabilityRegistry?.get(capabilityId);
    const request = createCapabilityRequest({
      capability: capabilityId,
      pluginId: capability?.pluginId || 'vehicle-identification-manual',
      input,
      context,
      inputContract: capability?.inputContract,
      resultContract: capability?.resultContract,
    });

    const response = this.capabilityPipeline.run(request, {
      validate: (requestInput) => this.securityGuardian.validateVehicleIdentificationRequest(requestInput),
    });

    return this.toVehicleIdentificationResponse(response);
  }

  toVehicleIdentificationResponse(response) {
    if (!response.ok) {
      return {
        ok: false,
        normalizedPlate: response.normalizedInput?.plate ?? response.normalizedInput?.normalizedPlate ?? null,
        error: response.error,
        auditId: response.auditId,
        audit: response.audit,
      };
    }

    return {
      ok: true,
      normalizedPlate: response.normalizedInput.plate,
      vehicle: response.result.vehicle,
      source: response.result.source,
      auditId: response.auditId,
      execution: response.execution,
      audit: response.audit,
    };
  }
}

module.exports = { WorkflowEngine };
