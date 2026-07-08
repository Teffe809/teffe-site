class WorkflowEngine {
  constructor({ pluginEngine, memoryEngine, auditLog, securityGuardian }) {
    this.pluginEngine = pluginEngine;
    this.memoryEngine = memoryEngine;
    this.auditLog = auditLog;
    this.securityGuardian = securityGuardian;
  }

  runVehicleIdentification(input, context = {}) {
    const guard = this.securityGuardian.validateVehicleIdentificationRequest(input);

    if (!guard.allowed) {
      const deniedAudit = this.auditLog.record({
        type: 'capability.execution.denied',
        capability: 'vehicle-identification.manual',
        error: guard.error,
        normalizedPlate: guard.normalizedPlate,
        input,
      });

      return {
        ok: false,
        normalizedPlate: guard.normalizedPlate,
        error: guard.error,
        auditId: deniedAudit.id,
        audit: {
          denied: deniedAudit,
        },
      };
    }

    const startedAudit = this.auditLog.record({
      type: 'capability.execution.started',
      capability: 'vehicle-identification.manual',
      input: guard.sanitizedInput,
      context,
    });

    const result = this.pluginEngine.execute(
      'vehicle-identification-manual',
      guard.sanitizedInput,
      context
    );

    const execution = this.memoryEngine.persistExecution({
      id: `exec_${Date.now()}`,
      capability: 'vehicle-identification.manual',
      input: guard.sanitizedInput,
      result,
      auditId: startedAudit.id,
      timestamp: new Date().toISOString(),
      context,
    });

    const completedAudit = this.auditLog.record({
      type: 'capability.execution.completed',
      capability: 'vehicle-identification.manual',
      executionId: execution.id,
      result,
    });

    return {
      ok: true,
      normalizedPlate: guard.normalizedPlate,
      vehicle: result.vehicle,
      source: result.source,
      auditId: completedAudit.id,
      execution,
      audit: {
        started: startedAudit,
        completed: completedAudit,
      },
    };
  }
}

module.exports = { WorkflowEngine };
