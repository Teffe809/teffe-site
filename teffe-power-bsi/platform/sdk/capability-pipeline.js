const { CapabilityError } = require('./capability-error');
const {
  createCapabilityErrorResponse,
  createCapabilitySuccessResponse,
} = require('./capability-response');
const { ContractValidator } = require('./contract-validator');

class CapabilityPipeline {
  constructor({
    pluginEngine,
    memoryEngine,
    auditLog,
    domainKnowledgeEngine = null,
    contractValidator = new ContractValidator(),
  }) {
    this.pluginEngine = pluginEngine;
    this.memoryEngine = memoryEngine;
    this.auditLog = auditLog;
    this.domainKnowledgeEngine = domainKnowledgeEngine;
    this.contractValidator = contractValidator;
  }

  run(request, hooks) {
    const baseExecutionContext = this.withMemoryContext(request.executionContext);
    const contractValidation = this.contractValidator.validateRequest(
      request,
      request.contracts?.input
    );

    if (!contractValidation.valid) {
      return this.deny(request, contractValidation, 'request_contract', baseExecutionContext);
    }

    const validation = hooks.validate(request.input);

    if (!validation.allowed) {
      return this.deny(request, validation, 'business_validation', baseExecutionContext);
    }

    const normalizedInput = validation.normalizedInput ?? validation.sanitizedInput;
    const startedAudit = this.auditLog.record(this.withMetadata(request, {
      type: 'capability.execution.started',
      capability: request.capability,
      input: normalizedInput,
      context: request.context,
      executionContext: baseExecutionContext,
    }));

    let executionContext = this.withAuditContext(baseExecutionContext, {
      startedId: startedAudit.id,
    });
    executionContext = this.withRuntimeServices(executionContext, request, startedAudit);

    let result;
    try {
      result = this.pluginEngine.execute(request.pluginId, normalizedInput, executionContext);
    } catch (error) {
      return this.deny(
        request,
        {
          error: CapabilityError.from(error),
          normalizedInput,
        },
        'execution',
        executionContext
      );
    }
    const resultValidation = this.contractValidator.validateResult(
      result,
      request.contracts?.result
    );

    if (!resultValidation.valid) {
      return this.deny(
        request,
        { ...resultValidation, normalizedInput },
        'result_contract',
        executionContext
      );
    }

    const executionCandidate = this.withMetadata(request, {
      id: `exec_${Date.now()}`,
      capability: request.capability,
      input: normalizedInput,
      result,
      auditId: startedAudit.id,
      timestamp: new Date().toISOString(),
      context: request.context,
      executionContext: this.withoutRuntimeServices(executionContext),
    });

    const responseCandidate = createCapabilitySuccessResponse({
      normalizedInput,
      result,
      execution: executionCandidate,
      audit: {
        started: startedAudit,
        completed: { id: 'pending_contract_validation' },
      },
    });
    const responseValidation = this.contractValidator.validateResponse(responseCandidate);

    if (!responseValidation.valid) {
      return this.deny(
        request,
        { ...responseValidation, normalizedInput },
        'response_contract',
        executionContext
      );
    }

    const execution = this.memoryEngine.persistExecution(executionCandidate);

    const completedAudit = this.auditLog.record({
      type: 'capability.execution.completed',
      capability: request.capability,
      executionId: execution.id,
      result,
    });

    return createCapabilitySuccessResponse({
      normalizedInput,
      result,
      execution,
      audit: {
        started: startedAudit,
        completed: completedAudit,
      },
    });
  }

  deny(request, validation, stage = 'business_validation', executionContext = null) {
    const error = CapabilityError.from(validation.error);
    const normalizedInput = validation.normalizedInput ?? null;
    const normalizedValue =
      validation.normalizedPlate ??
      normalizedInput?.normalizedPlate ??
      normalizedInput?.plate ??
      null;
    const deniedAudit = this.auditLog.record(this.withMetadata(request, {
      type: 'capability.execution.denied',
      capability: request.capability,
      stage,
      error,
      normalizedInput,
      normalizedPlate: normalizedValue,
      input: request.input,
      context: request.context,
      executionContext: executionContext || this.withMemoryContext(request.executionContext || {}),
    }));

    const response = createCapabilityErrorResponse({
      normalizedInput,
      error,
      audit: {
        denied: deniedAudit,
      },
    });
    const responseValidation = this.contractValidator.validateResponse(response);

    if (!responseValidation.valid) {
      throw new Error('CapabilityPipeline produced an invalid error response');
    }

    return response;
  }

  withMetadata(request, payload) {
    if (!request.metadata || Object.keys(request.metadata).length === 0) {
      return payload;
    }

    return {
      ...payload,
      metadata: request.metadata,
    };
  }

  withMemoryContext(executionContext) {
    const context = executionContext || {};

    return {
      ...context,
      memory: context.memory ?? {
        latestExecution: this.memoryEngine.latestExecution(),
      },
    };
  }

  withAuditContext(executionContext, audit) {
    return {
      ...executionContext,
      audit: executionContext.audit ?? audit,
    };
  }

  withRuntimeServices(executionContext, request, startedAudit) {
    if (!request.requirements?.includes('domainKnowledge')) {
      return executionContext;
    }

    if (!this.domainKnowledgeEngine) {
      throw new Error('Domain Knowledge Engine is not available');
    }

    const context = { ...executionContext };
    const domainKnowledge = {
      getServiceIntelligence: (parameters) => {
        return this.queryDomainKnowledge(
          'get_service_intelligence',
          parameters,
          request,
          startedAudit,
          executionContext
        );
      },
      getRecommendations: (parameters) => {
        return this.queryDomainKnowledge(
          'get_recommendations',
          parameters,
          request,
          startedAudit,
          executionContext
        );
      },
      getBudgetStructure: (parameters) => {
        return this.queryDomainKnowledge(
          'get_budget_structure',
          parameters,
          request,
          startedAudit,
          executionContext
        );
      },
    };

    Object.defineProperty(context, 'services', {
      value: { domainKnowledge },
      enumerable: false,
    });
    return context;
  }

  withoutRuntimeServices(executionContext) {
    return { ...executionContext };
  }

  queryDomainKnowledge(operation, parameters, request, startedAudit, executionContext) {
    const methodByOperation = {
      get_service_intelligence: 'getServiceIntelligence',
      get_recommendations: 'getRecommendations',
      get_budget_structure: 'getBudgetStructure',
    };
    const method = methodByOperation[operation];
    const result = this.domainKnowledgeEngine[method](parameters);
    this.auditLog.record({
      type: 'domain.knowledge.queried',
      domain: 'autoparts',
      operation,
      capability: request.capability,
      capabilityAuditId: startedAudit.id,
      parameters,
      result,
      executionContext,
    });
    return result;
  }
}

module.exports = { CapabilityPipeline };
