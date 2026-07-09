function createWebhookSecurityResult(input = {}) {
  const ok = Boolean(input.ok);
  return {
    ok,
    provider: input.provider ?? null,
    tenantId: input.tenantId ?? null,
    channel: input.channel ?? null,
    reason: ok ? null : input.reason ?? 'webhook_security_failed',
    statusCode: input.statusCode ?? (ok ? 200 : 401),
    metadata: input.metadata ?? {},
  };
}

module.exports = { createWebhookSecurityResult };
