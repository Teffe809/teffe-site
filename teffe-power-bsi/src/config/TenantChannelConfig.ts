function createTenantChannelConfig(input = {}) {
  return {
    tenantId: String(input.tenantId ?? '').trim().toLowerCase(),
    channel: String(input.channel ?? '').trim().toLowerCase(),
    provider: String(input.provider ?? '').trim().toLowerCase(),
    phoneNumberId: input.phoneNumberId ?? null,
    businessAccountId: input.businessAccountId ?? null,
    verifyTokenRef: input.verifyTokenRef ?? null,
    appSecretRef: input.appSecretRef ?? null,
    accessTokenRef: input.accessTokenRef ?? null,
    enabled: input.enabled !== false,
    mode: input.mode ?? 'mock',
    metadata: input.metadata ?? {},
  };
}

module.exports = { createTenantChannelConfig };
