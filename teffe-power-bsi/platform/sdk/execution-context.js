function createExecutionContext(input = {}) {
  const context = {
    tenant: input.tenant ?? null,
    user: input.user ?? createUserContext(input),
    conversation: input.conversation ?? createConversationContext(input),
    workflow: input.workflow ?? createWorkflowContext(input),
    memory: input.memory ?? null,
    audit: input.audit ?? null,
    permissions: input.permissions ?? [],
    runtime: {
      source: input.source ?? input.runtime?.source ?? 'platform',
      intent: input.intent ?? input.runtime?.intent ?? null,
      ai: input.ai ?? input.runtime?.ai ?? false,
      createdAt: input.runtime?.createdAt ?? new Date().toISOString(),
      ...withoutReservedRuntime(input.runtime),
    },
    ...(input.domainKnowledge != null
      ? { domainKnowledge: input.domainKnowledge }
      : {}),
  };

  return context;
}

function createUserContext(input) {
  if (!input.userId) {
    return null;
  }

  return {
    id: input.userId,
  };
}

function createConversationContext(input) {
  if (!input.conversationId) {
    return null;
  }

  return {
    id: input.conversationId,
  };
}

function createWorkflowContext(input) {
  if (!input.workflowId) {
    return null;
  }

  return {
    id: input.workflowId,
  };
}

function withoutReservedRuntime(runtime = {}) {
  const { source, intent, ai, createdAt, ...rest } = runtime;
  return rest;
}

module.exports = { createExecutionContext };
