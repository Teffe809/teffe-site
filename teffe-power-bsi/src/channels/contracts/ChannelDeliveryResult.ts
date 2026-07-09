function createChannelDeliveryResult(input = {}) {
  const ok = Boolean(input.ok);
  return {
    ok,
    channel: String(input.channel ?? '').trim().toLowerCase(),
    messageId: input.messageId ?? null,
    providerMessageId: input.providerMessageId ?? null,
    tenantId: input.tenantId ?? input.tenantIdentity?.tenantId ?? null,
    status: input.status ?? (ok ? 'sent' : 'failed'),
    error: ok ? null : input.error ?? { code: 'delivery_failed', message: 'Delivery failed' },
    timestamp: input.timestamp
      ? new Date(input.timestamp).toISOString()
      : new Date().toISOString(),
    metadata: input.metadata ?? {},
  };
}

module.exports = { createChannelDeliveryResult };
