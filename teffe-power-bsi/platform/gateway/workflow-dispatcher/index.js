const SUPPORTED_WORKFLOWS = ['autoparts.full-sales-flow'];

class WorkflowDispatcher {
  constructor({ tenantSpecializationRegistry, libraryRegistry }) {
    this.tenantSpecializationRegistry = tenantSpecializationRegistry;
    this.libraryRegistry = libraryRegistry;
  }

  dispatch(message, workflowEngine, context = {}) {
    const tenantId = message?.tenant?.id;
    const profile = this.tenantSpecializationRegistry.resolveRuntimeProfile(tenantId);
    if (!profile) {
      return this.failure('tenant_not_found', 'tenant specialization was not found');
    }

    const workflow = profile.workflow;
    if (!SUPPORTED_WORKFLOWS.includes(workflow)) {
      return this.failure(
        'workflow_not_supported',
        `workflow is not supported by dispatcher: ${workflow}`,
        { workflow }
      );
    }

    const workflowInput = this.extractWorkflowInput(message);
    if (!workflowInput) {
      return this.failure(
        'workflow_input_required',
        'dispatch message metadata must include workflowInput',
        { workflow }
      );
    }

    if (workflow === 'autoparts.full-sales-flow') {
      const result = workflowEngine.runAutopartsFullSalesFlow(
        workflowInput,
        {
          ...context,
          source: 'workflow-dispatcher',
          tenantId,
          channel: message.channel,
          communicationMessageId: message.id,
          intent: workflow,
          ai: false,
        }
      );

      return {
        ok: result.ok,
        workflow,
        workflowInput,
        result,
      };
    }

    return this.failure('workflow_not_supported', `workflow is not supported by dispatcher: ${workflow}`);
  }

  extractWorkflowInput(message) {
    const input = message?.metadata?.workflowInput ?? message?.metadata?.workflow_input;
    if (!input || typeof input !== 'object') {
      return null;
    }

    return {
      plate: input.plate,
      category: input.category ?? input.partCategory,
      partCategory: input.partCategory,
    };
  }

  failure(code, message, details = {}) {
    return {
      ok: false,
      error: {
        code,
        message,
        ...details,
      },
    };
  }
}

module.exports = {
  SUPPORTED_WORKFLOWS,
  WorkflowDispatcher,
};
