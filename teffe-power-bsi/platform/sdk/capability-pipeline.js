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
    decisionRulesEngine = null,
    libraryRegistry = null,
    libraryDiscovery = null,
    contractValidator = new ContractValidator(),
  }) {
    this.pluginEngine = pluginEngine;
    this.memoryEngine = memoryEngine;
    this.auditLog = auditLog;
    this.domainKnowledgeEngine = domainKnowledgeEngine;
    this.decisionRulesEngine = decisionRulesEngine;
    this.libraryRegistry = libraryRegistry;
    this.libraryDiscovery = libraryDiscovery;
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
    const requirements = request.requirements || [];
    if (requirements.length === 0) {
      return executionContext;
    }

    const context = { ...executionContext };
    const services = {};

    if (requirements.includes('domainKnowledge')) {
      if (!this.domainKnowledgeEngine) {
        throw new Error('Domain Knowledge Engine is not available');
      }

      services.domainKnowledge = {
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
    }

    if (requirements.includes('decisionRules')) {
      if (!this.decisionRulesEngine) {
        throw new Error('Decision Rules Engine is not available');
      }

      services.decisionRules = {
        evaluate: (pricing) => {
          const result = this.decisionRulesEngine.evaluate(pricing);
          this.auditLog.record({
            type: 'decision.rules.evaluated',
            operation: 'evaluate_decision',
            capability: request.capability,
            capabilityAuditId: startedAudit.id,
            pricing,
            result,
            executionContext,
          });
          return result;
        },
        buildSalesStrategy: (parameters) => {
          const result = this.decisionRulesEngine.buildSalesStrategy(parameters);
          this.auditLog.record({
            type: 'decision.rules.evaluated',
            operation: 'build_sales_strategy',
            capability: request.capability,
            capabilityAuditId: startedAudit.id,
            parameters,
            result,
            executionContext,
          });
          return result;
        },
      };
    }

    if (requirements.includes('libraries')) {
      if (!this.libraryRegistry || !this.libraryDiscovery) {
        throw new Error('Library Registry is not available');
      }

      services.libraries = {
        findForConsumer: (capabilityId, type) => {
          const matches = this.libraryDiscovery.findByConsumer(capabilityId)
            .filter((library) => library.type === type && library.status === 'active');
          const result = matches.sort((left, right) =>
            this.libraryRegistry.compareVersions(left.version, right.version)
          ).at(-1) || null;
          this.auditLog.record({
            type: 'library.discovery.queried',
            operation: 'find_for_consumer',
            capability: request.capability,
            capabilityAuditId: startedAudit.id,
            query: { capabilityId, type, status: 'active' },
            found: result != null,
            result,
            executionContext,
          });
          return result;
        },
      };
    }

    Object.defineProperty(context, 'services', {
      value: services,
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
