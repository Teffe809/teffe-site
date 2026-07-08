const { CapabilityError } = require('./capability-error');
const {
  createCapabilityErrorResponse,
  createCapabilitySuccessResponse,
} = require('./capability-response');

class CapabilityPipeline {
  constructor({ pluginEngine, memoryEngine, auditLog }) {
    this.pluginEngine = pluginEngine;
    this.memoryEngine = memoryEngine;
    this.auditLog = auditLog;
  }

  run(request, hooks) {
    const validation = hooks.validate(request.input);
    const baseExecutionContext = this.withMemoryContext(request.executionContext);

    if (!validation.allowed) {
      return this.deny(request, validation);
    }

    const normalizedInput = validation.normalizedInput ?? validation.sanitizedInput;
    const startedAudit = this.auditLog.record(this.withMetadata(request, {
      type: 'capability.execution.started',
      capability: request.capability,
      input: normalizedInput,
      context: request.context,
      executionContext: baseExecutionContext,
    }));

    const executionContext = this.withAuditContext(baseExecutionContext, {
      startedId: startedAudit.id,
    });
    const result = this.pluginEngine.execute(request.pluginId, normalizedInput, executionContext);

    const execution = this.memoryEngine.persistExecution(this.withMetadata(request, {
      id: `exec_${Date.now()}`,
      capability: request.capability,
      input: normalizedInput,
      result,
      auditId: startedAudit.id,
      timestamp: new Date().toISOString(),
      context: request.context,
      executionContext,
    }));

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

  deny(request, validation) {
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
      error,
      normalizedInput,
      normalizedPlate: normalizedValue,
      input: request.input,
      context: request.context,
      executionContext: this.withMemoryContext(request.executionContext),
    }));

    return createCapabilityErrorResponse({
      normalizedInput,
      error,
      audit: {
        denied: deniedAudit,
      },
    });
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
    return {
      ...executionContext,
      memory: executionContext.memory ?? {
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
}

module.exports = { CapabilityPipeline };
