const { CapabilityPipeline, createCapabilityRequest, createExecutionContext } = require('../sdk');

class WorkflowEngine {
  constructor({
    pluginEngine,
    memoryEngine,
    auditLog,
    securityGuardian,
    capabilityPipeline,
    capabilityRegistry,
    domainKnowledgeEngine,
  }) {
    this.securityGuardian = securityGuardian;
    this.capabilityRegistry = capabilityRegistry;
    this.auditLog = auditLog;
    this.domainKnowledgeEngine = domainKnowledgeEngine;
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

  runVehicleCompatibility(input, context = {}) {
    const capabilityId = 'vehicle.compatibility';
    const capability = this.capabilityRegistry?.get(capabilityId);
    const request = createCapabilityRequest({
      capability: capabilityId,
      pluginId: capability?.pluginId || 'vehicle-compatibility',
      input,
      context,
      inputContract: capability?.inputContract,
      resultContract: capability?.resultContract,
    });

    const response = this.capabilityPipeline.run(request, {
      validate: (requestInput) => this.securityGuardian.validateVehicleCompatibilityRequest(requestInput),
    });

    return this.toVehicleCompatibilityResponse(response);
  }

  runStockAvailability(input, context = {}) {
    const capabilityId = 'stock.availability';
    const capability = this.capabilityRegistry?.get(capabilityId);
    const request = createCapabilityRequest({
      capability: capabilityId,
      pluginId: capability?.pluginId || 'stock-availability',
      input,
      context,
      inputContract: capability?.inputContract,
      resultContract: capability?.resultContract,
    });

    const response = this.capabilityPipeline.run(request, {
      validate: (requestInput) => this.securityGuardian.validateStockAvailabilityRequest(requestInput),
    });

    return this.toStockAvailabilityResponse(response);
  }

  getDomainSystem(name, context = {}) {
    return this.queryDomainKnowledge(
      'get_system_by_name',
      { name },
      () => this.domainKnowledgeEngine.getSystemByName(name),
      context
    );
  }

  getDomainComponents(systemName, context = {}) {
    return this.queryDomainKnowledge(
      'get_components',
      { systemName },
      () => this.domainKnowledgeEngine.getComponents(systemName),
      context
    );
  }

  getDomainSystemsByComponent(component, context = {}) {
    return this.queryDomainKnowledge(
      'get_systems_by_component',
      { component },
      () => this.domainKnowledgeEngine.getSystemsByComponent(component),
      context
    );
  }

  checkDomainMembership(component, systemName, context = {}) {
    return this.queryDomainKnowledge(
      'component_belongs_to_system',
      { component, systemName },
      () => this.domainKnowledgeEngine.componentBelongsToSystem(component, systemName),
      context
    );
  }

  queryDomainKnowledge(operation, parameters, query, context = {}) {
    if (!this.domainKnowledgeEngine) {
      throw new Error('Domain Knowledge Engine is not available');
    }

    const executionContext = createExecutionContext({
      ...context,
      domainKnowledge: {
        engine: 'domain-knowledge',
        operation,
      },
    });
    const result = query();
    const audit = this.auditLog.record({
      type: 'domain.knowledge.queried',
      domain: 'autoparts',
      operation,
      parameters,
      result,
      executionContext,
    });

    return {
      ok: true,
      result,
      auditId: audit.id,
      audit,
    };
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

  toVehicleCompatibilityResponse(response) {
    if (!response.ok) {
      return {
        ok: false,
        error: response.error,
        auditId: response.auditId,
        audit: response.audit,
      };
    }

    return {
      ok: true,
      vehicle: response.result.vehicle,
      category: response.result.category,
      compatibleParts: response.result.compatibleParts,
      source: response.result.source,
      auditId: response.auditId,
      execution: response.execution,
      audit: response.audit,
    };
  }

  toStockAvailabilityResponse(response) {
    if (!response.ok) {
      return {
        ok: false,
        error: response.error,
        auditId: response.auditId,
        audit: response.audit,
      };
    }

    return {
      ok: true,
      vehicle: response.result.vehicle,
      part: response.result.part,
      available: response.result.available,
      quantity: response.result.quantity,
      branch: response.result.branch,
      estimatedDelivery: response.result.estimatedDelivery,
      notes: response.result.notes,
      source: response.result.source,
      auditId: response.auditId,
      execution: response.execution,
      audit: response.audit,
    };
  }
}

module.exports = { WorkflowEngine };
