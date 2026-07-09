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
    libraryRegistry,
    libraryDiscovery,
    tenantSpecializationRegistry,
  }) {
    this.securityGuardian = securityGuardian;
    this.capabilityRegistry = capabilityRegistry;
    this.auditLog = auditLog;
    this.memoryEngine = memoryEngine;
    this.domainKnowledgeEngine = domainKnowledgeEngine;
    this.libraryRegistry = libraryRegistry;
    this.libraryDiscovery = libraryDiscovery;
    this.tenantSpecializationRegistry = tenantSpecializationRegistry;
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

  runServiceIntelligence(input, context = {}) {
    const capabilityId = 'service.intelligence';
    const capability = this.capabilityRegistry?.get(capabilityId);
    const request = createCapabilityRequest({
      capability: capabilityId,
      pluginId: capability?.pluginId || 'service-intelligence',
      input,
      context,
      inputContract: capability?.inputContract,
      resultContract: capability?.resultContract,
      requirements: capability?.requirements,
    });

    const response = this.capabilityPipeline.run(request, {
      validate: (requestInput) => this.securityGuardian.validateServiceIntelligenceRequest(requestInput),
    });

    return this.toServiceIntelligenceResponse(response);
  }

  runRecommendation(input, context = {}) {
    const capabilityId = 'recommendation.engine';
    const capability = this.capabilityRegistry?.get(capabilityId);
    const request = createCapabilityRequest({
      capability: capabilityId,
      pluginId: capability?.pluginId || 'recommendation-engine',
      input,
      context,
      inputContract: capability?.inputContract,
      resultContract: capability?.resultContract,
      requirements: capability?.requirements,
    });

    const response = this.capabilityPipeline.run(request, {
      validate: (requestInput) => this.securityGuardian.validateRecommendationRequest(requestInput),
    });

    return this.toRecommendationResponse(response);
  }

  runBudgetIntelligence(input, context = {}) {
    const capabilityId = 'budget.intelligence';
    const capability = this.capabilityRegistry?.get(capabilityId);
    const request = createCapabilityRequest({
      capability: capabilityId,
      pluginId: capability?.pluginId || 'budget-intelligence',
      input,
      context,
      inputContract: capability?.inputContract,
      resultContract: capability?.resultContract,
      requirements: capability?.requirements,
    });

    const response = this.capabilityPipeline.run(request, {
      validate: (requestInput) => this.securityGuardian.validateBudgetIntelligenceRequest(requestInput),
    });

    return this.toBudgetIntelligenceResponse(response);
  }

  runPricingIntelligence(input, context = {}) {
    const capabilityId = 'pricing.intelligence';
    const capability = this.capabilityRegistry?.get(capabilityId);
    const request = createCapabilityRequest({
      capability: capabilityId,
      pluginId: capability?.pluginId || 'pricing-intelligence',
      input,
      context,
      inputContract: capability?.inputContract,
      resultContract: capability?.resultContract,
    });

    const response = this.capabilityPipeline.run(request, {
      validate: (requestInput) => this.securityGuardian.validatePricingIntelligenceRequest(requestInput),
    });

    return this.toPricingIntelligenceResponse(response);
  }

  runDecisionIntelligence(input, context = {}) {
    const capabilityId = 'decision.intelligence';
    const capability = this.capabilityRegistry?.get(capabilityId);
    const request = createCapabilityRequest({
      capability: capabilityId,
      pluginId: capability?.pluginId || 'decision-intelligence',
      input,
      context,
      inputContract: capability?.inputContract,
      resultContract: capability?.resultContract,
      requirements: capability?.requirements,
    });

    const response = this.capabilityPipeline.run(request, {
      validate: (requestInput) => this.securityGuardian.validateDecisionIntelligenceRequest(requestInput),
    });

    return this.toDecisionIntelligenceResponse(response);
  }

  runSalesIntelligence(input, context = {}) {
    const capabilityId = 'sales.intelligence';
    const capability = this.capabilityRegistry?.get(capabilityId);
    const request = createCapabilityRequest({
      capability: capabilityId,
      pluginId: capability?.pluginId || 'sales-intelligence',
      input,
      context,
      inputContract: capability?.inputContract,
      resultContract: capability?.resultContract,
      requirements: capability?.requirements,
    });

    const response = this.capabilityPipeline.run(request, {
      validate: (requestInput) => this.securityGuardian.validateSalesIntelligenceRequest(requestInput),
    });

    return this.toSalesIntelligenceResponse(response);
  }

  runAutopartsFullSalesFlow(input, context = {}) {
    const workflowId = 'autoparts.full-sales-flow';
    const validation = this.securityGuardian.validateAutopartsFullSalesFlowRequest(input);
    const startedAt = new Date().toISOString();
    const runId = `workflow_${Date.now()}`;
    const tenantProfile = context.tenantId
      ? this.tenantSpecializationRegistry?.resolveRuntimeProfile(context.tenantId)
      : null;
    const baseContext = {
      ...context,
      ...(tenantProfile
        ? {
          tenant: {
            id: tenantProfile.tenant.tenantId,
            specialistName: tenantProfile.tenant.specialistName,
            segment: tenantProfile.tenant.segment,
            primaryLibrary: tenantProfile.tenant.primaryLibrary,
            primaryWorkflow: tenantProfile.tenant.primaryWorkflow,
          },
        }
        : {}),
      workflowId,
      workflow: {
        id: workflowId,
        runId,
        ...(tenantProfile
          ? {
            tenantSpecialization: {
              specialistName: tenantProfile.tenant.specialistName,
              segment: tenantProfile.tenant.segment,
            },
          }
          : {}),
      },
    };

    const startedAudit = this.auditLog.record({
      type: 'workflow.execution.started',
      workflow: workflowId,
      runId,
      input,
      executionContext: createExecutionContext(baseContext),
    });

    if (!validation.allowed) {
      return this.failWorkflow({
        workflowId,
        runId,
        startedAt,
        startedAudit,
        step: 'request.validation',
        steps: [],
        error: validation.error,
        context: baseContext,
      });
    }

    const request = validation.normalizedInput;
    const steps = [];
    const runStep = (name, execute) => {
      const response = execute({
        ...baseContext,
        workflow: {
          ...baseContext.workflow,
          step: name,
        },
      });
      steps.push({
        name,
        ok: response.ok,
        auditId: response.auditId ?? null,
      });
      return response;
    };

    const identification = runStep('vehicle-identification', (stepContext) =>
      this.runVehicleIdentification({ plate: request.plate }, stepContext)
    );
    if (!identification.ok) {
      return this.failWorkflowFromStep({
        workflowId,
        runId,
        startedAt,
        startedAudit,
        step: 'vehicle-identification',
        steps,
        response: identification,
        context: baseContext,
      });
    }

    const compatibility = runStep('vehicle-compatibility', (stepContext) =>
      this.runVehicleCompatibility(
        { vehicle: identification.vehicle, category: request.category },
        stepContext
      )
    );
    if (!compatibility.ok) {
      return this.failWorkflowFromStep({
        workflowId,
        runId,
        startedAt,
        startedAudit,
        step: 'vehicle-compatibility',
        steps,
        response: compatibility,
        context: baseContext,
      });
    }

    const part = compatibility.compatibleParts[0];
    const stock = runStep('stock-availability', (stepContext) =>
      this.runStockAvailability({ vehicle: identification.vehicle, part }, stepContext)
    );
    if (!stock.ok) {
      return this.failWorkflowFromStep({
        workflowId,
        runId,
        startedAt,
        startedAudit,
        step: 'stock-availability',
        steps,
        response: stock,
        context: baseContext,
      });
    }

    const service = runStep('service-intelligence', (stepContext) =>
      this.runServiceIntelligence(
        { vehicle: identification.vehicle, part, category: compatibility.category },
        stepContext
      )
    );
    if (!service.ok) {
      return this.failWorkflowFromStep({
        workflowId,
        runId,
        startedAt,
        startedAudit,
        step: 'service-intelligence',
        steps,
        response: service,
        context: baseContext,
      });
    }

    const serviceInput = this.pick(service, [
      'source',
      'system',
      'relatedComponents',
      'recommendations',
      'priority',
      'technicalJustification',
    ]);
    const recommendation = runStep('recommendation-engine', (stepContext) =>
      this.runRecommendation(
        {
          vehicle: identification.vehicle,
          part,
          category: compatibility.category,
          serviceIntelligence: serviceInput,
        },
        stepContext
      )
    );
    if (!recommendation.ok) {
      return this.failWorkflowFromStep({
        workflowId,
        runId,
        startedAt,
        startedAudit,
        step: 'recommendation-engine',
        steps,
        response: recommendation,
        context: baseContext,
      });
    }

    const recommendationInput = this.pick(recommendation, [
      'source',
      'complementaryComponents',
      'suggestedKits',
      'preventiveRecommendations',
      'technicalJustification',
      'priority',
      'confidence',
    ]);
    const budget = runStep('budget-intelligence', (stepContext) =>
      this.runBudgetIntelligence(
        {
          vehicle: identification.vehicle,
          part,
          category: compatibility.category,
          serviceIntelligence: serviceInput,
          recommendation: recommendationInput,
        },
        stepContext
      )
    );
    if (!budget.ok) {
      return this.failWorkflowFromStep({
        workflowId,
        runId,
        startedAt,
        startedAudit,
        step: 'budget-intelligence',
        steps,
        response: budget,
        context: baseContext,
      });
    }

    const budgetInput = this.pick(budget, [
      'source',
      'vehicle',
      'category',
      'mainItem',
      'complementaryItems',
      'systemGroups',
      'technicalKits',
      'sellerNotes',
      'auditId',
    ]);
    const pricing = runStep('pricing-intelligence', (stepContext) =>
      this.runPricingIntelligence({ budget: budgetInput }, stepContext)
    );
    if (!pricing.ok) {
      return this.failWorkflowFromStep({
        workflowId,
        runId,
        startedAt,
        startedAudit,
        step: 'pricing-intelligence',
        steps,
        response: pricing,
        context: baseContext,
      });
    }

    const pricingInput = this.pick(pricing, [
      'source',
      'budgetAuditId',
      'items',
      'discounts',
      'taxes',
      'margin',
      'validity',
      'totals',
      'commercialNotes',
      'auditId',
    ]);
    const decision = runStep('decision-intelligence', (stepContext) =>
      this.runDecisionIntelligence({ pricing: pricingInput }, stepContext)
    );
    if (!decision.ok) {
      return this.failWorkflowFromStep({
        workflowId,
        runId,
        startedAt,
        startedAudit,
        step: 'decision-intelligence',
        steps,
        response: decision,
        context: baseContext,
      });
    }

    const decisionInput = this.pick(decision, [
      'source',
      'pricingAuditId',
      'decisions',
      'summary',
      'justifications',
      'auditId',
    ]);
    const sales = runStep('sales-intelligence', (stepContext) =>
      this.runSalesIntelligence({ pricing: pricingInput, decision: decisionInput }, stepContext)
    );
    if (!sales.ok) {
      return this.failWorkflowFromStep({
        workflowId,
        runId,
        startedAt,
        startedAudit,
        step: 'sales-intelligence',
        steps,
        response: sales,
        context: baseContext,
      });
    }

    const completedAudit = this.auditLog.record({
      type: 'workflow.execution.completed',
      workflow: workflowId,
      runId,
      steps,
      executionContext: createExecutionContext(baseContext),
    });
    const workflow = this.memoryEngine.persistWorkflow({
      id: runId,
      workflow: workflowId,
      ok: true,
      startedAt,
      completedAt: new Date().toISOString(),
      startedAuditId: startedAudit.id,
      completedAuditId: completedAudit.id,
      steps,
      result: {
        vehicle: identification.vehicle,
        category: compatibility.category,
        part,
        stock: this.pick(stock, ['available', 'quantity', 'branch', 'estimatedDelivery', 'notes', 'auditId']),
        serviceIntelligence: serviceInput,
        recommendation: recommendationInput,
        budget: budgetInput,
        pricing: pricingInput,
        decision: decisionInput,
        sales: this.pick(sales, [
          'source',
          'pricingAuditId',
          'decisionAuditId',
          'library',
          'complementarySaleOpportunity',
          'commercialPriority',
          'technicalJustification',
          'suggestedApproach',
          'requiresHuman',
          'commercialRisks',
          'nextSteps',
          'auditId',
        ]),
      },
    });

    return {
      ok: true,
      workflow: workflowId,
      runId,
      steps,
      result: workflow.result,
      auditId: completedAudit.id,
      audit: {
        started: startedAudit,
        completed: completedAudit,
      },
      memory: workflow,
    };
  }

  findLibrary(input, context = {}) {
    const validation = this.securityGuardian.validateLibraryDiscoveryRequest(input);
    if (!validation.allowed) {
      const audit = this.auditLog.record({
        type: 'library.discovery.denied',
        input,
        error: validation.error,
        context,
      });
      return {
        ok: false,
        error: validation.error,
        auditId: audit.id,
        audit,
      };
    }

    const query = validation.normalizedInput;
    const executionContext = createExecutionContext({
      ...context,
      libraries: {
        operation: 'find_by_id',
        query,
      },
    });
    const result = this.libraryDiscovery.findById(query.id, query.version);
    const audit = this.auditLog.record({
      type: 'library.discovery.queried',
      query,
      found: result != null,
      result,
      executionContext,
    });
    const access = this.memoryEngine.persistLibraryAccess({
      id: `library_access_${Date.now()}`,
      query,
      found: result != null,
      library: result
        ? { id: result.id, version: result.version, type: result.type }
        : null,
      auditId: audit.id,
      timestamp: new Date().toISOString(),
      executionContext,
    });

    return {
      ok: true,
      result,
      auditId: audit.id,
      audit,
      access,
    };
  }

  getTenantSpecialization(input, context = {}) {
    const validation = this.securityGuardian.validateTenantSpecializationRequest(input);
    if (!validation.allowed) {
      const audit = this.auditLog.record({
        type: 'tenant.specialization.denied',
        input,
        error: validation.error,
        context,
      });
      return {
        ok: false,
        error: validation.error,
        auditId: audit.id,
        audit,
      };
    }

    const { tenantId } = validation.normalizedInput;
    const executionContext = createExecutionContext({
      ...context,
      tenantId,
      runtime: {
        operation: 'tenant_specialization_lookup',
      },
    });
    const profile = this.tenantSpecializationRegistry.resolveRuntimeProfile(tenantId);
    if (!profile) {
      const error = {
        code: 'tenant_not_found',
        message: 'tenant specialization was not found',
      };
      const audit = this.auditLog.record({
        type: 'tenant.specialization.denied',
        tenantId,
        error,
        executionContext,
      });
      return {
        ok: false,
        error,
        auditId: audit.id,
        audit,
      };
    }

    const audit = this.auditLog.record({
      type: 'tenant.specialization.resolved',
      tenantId,
      tenant: profile.tenant,
      library: profile.library
        ? { id: profile.library.id, version: profile.library.version, type: profile.library.type }
        : null,
      workflow: profile.workflow,
      executionContext,
    });
    const access = this.memoryEngine.persistTenantAccess({
      id: `tenant_access_${Date.now()}`,
      tenantId,
      specialistName: profile.tenant.specialistName,
      segment: profile.tenant.segment,
      library: profile.library
        ? { id: profile.library.id, version: profile.library.version, type: profile.library.type }
        : null,
      workflow: profile.workflow,
      auditId: audit.id,
      timestamp: new Date().toISOString(),
      executionContext,
    });

    return {
      ok: true,
      tenant: profile.tenant,
      library: profile.library,
      workflow: profile.workflow,
      personality: profile.personality,
      textTone: profile.textTone,
      voice: profile.voice,
      enabledChannels: profile.enabledChannels,
      humanHandoffPolicy: profile.humanHandoffPolicy,
      auditId: audit.id,
      audit,
      access,
    };
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

  failWorkflowFromStep({
    workflowId,
    runId,
    startedAt,
    startedAudit,
    step,
    steps,
    response,
    context,
  }) {
    return this.failWorkflow({
      workflowId,
      runId,
      startedAt,
      startedAudit,
      step,
      steps,
      error: response.error,
      failedAuditId: response.auditId ?? null,
      context,
    });
  }

  failWorkflow({
    workflowId,
    runId,
    startedAt,
    startedAudit,
    step,
    steps,
    error,
    failedAuditId = null,
    context,
  }) {
    const failedAudit = this.auditLog.record({
      type: 'workflow.execution.failed',
      workflow: workflowId,
      runId,
      failedStep: step,
      failedAuditId,
      error,
      steps,
      executionContext: createExecutionContext(context),
    });
    const workflow = this.memoryEngine.persistWorkflow({
      id: runId,
      workflow: workflowId,
      ok: false,
      startedAt,
      completedAt: new Date().toISOString(),
      startedAuditId: startedAudit.id,
      failedAuditId: failedAudit.id,
      failedStep: step,
      steps,
      error,
    });

    return {
      ok: false,
      workflow: workflowId,
      runId,
      failedStep: step,
      steps,
      error,
      auditId: failedAudit.id,
      audit: {
        started: startedAudit,
        failed: failedAudit,
      },
      memory: workflow,
    };
  }

  pick(source, fields) {
    return Object.fromEntries(fields.map((field) => [field, source[field]]));
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

  toServiceIntelligenceResponse(response) {
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
      category: response.result.category,
      system: response.result.system,
      relatedComponents: response.result.relatedComponents,
      recommendations: response.result.recommendations,
      priority: response.result.priority,
      technicalJustification: response.result.technicalJustification,
      source: response.result.source,
      auditId: response.auditId,
      execution: response.execution,
      audit: response.audit,
    };
  }

  toRecommendationResponse(response) {
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
      category: response.result.category,
      complementaryComponents: response.result.complementaryComponents,
      suggestedKits: response.result.suggestedKits,
      preventiveRecommendations: response.result.preventiveRecommendations,
      technicalJustification: response.result.technicalJustification,
      priority: response.result.priority,
      confidence: response.result.confidence,
      source: response.result.source,
      auditId: response.auditId,
      execution: response.execution,
      audit: response.audit,
    };
  }

  toBudgetIntelligenceResponse(response) {
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
      mainItem: response.result.mainItem,
      complementaryItems: response.result.complementaryItems,
      systemGroups: response.result.systemGroups,
      technicalKits: response.result.technicalKits,
      sellerNotes: response.result.sellerNotes,
      source: response.result.source,
      auditId: response.auditId,
      execution: response.execution,
      audit: response.audit,
    };
  }

  toPricingIntelligenceResponse(response) {
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
      source: response.result.source,
      budgetAuditId: response.result.budgetAuditId,
      items: response.result.items,
      discounts: response.result.discounts,
      taxes: response.result.taxes,
      margin: response.result.margin,
      validity: response.result.validity,
      totals: response.result.totals,
      commercialNotes: response.result.commercialNotes,
      auditId: response.auditId,
      execution: response.execution,
      audit: response.audit,
    };
  }

  toDecisionIntelligenceResponse(response) {
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
      source: response.result.source,
      pricingAuditId: response.result.pricingAuditId,
      decisions: response.result.decisions,
      summary: response.result.summary,
      justifications: response.result.justifications,
      auditId: response.auditId,
      execution: response.execution,
      audit: response.audit,
    };
  }

  toSalesIntelligenceResponse(response) {
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
      source: response.result.source,
      pricingAuditId: response.result.pricingAuditId,
      decisionAuditId: response.result.decisionAuditId,
      library: response.result.library,
      complementarySaleOpportunity: response.result.complementarySaleOpportunity,
      commercialPriority: response.result.commercialPriority,
      technicalJustification: response.result.technicalJustification,
      suggestedApproach: response.result.suggestedApproach,
      requiresHuman: response.result.requiresHuman,
      commercialRisks: response.result.commercialRisks,
      nextSteps: response.result.nextSteps,
      auditId: response.auditId,
      execution: response.execution,
      audit: response.audit,
    };
  }
}

module.exports = { WorkflowEngine };
