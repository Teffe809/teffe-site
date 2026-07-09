function createChannelTenantIdentity(input = {}) {
  const tenantId = String(input.tenantId ?? input.tenant_id ?? input.tenant ?? '').trim().toLowerCase();
  if (!tenantId) {
    throw new Error('tenantId is required');
  }

  return {
    tenantId,
    channelTenantId: input.channelTenantId ?? input.channel_tenant_id ?? null,
    displayName: input.displayName ?? input.display_name ?? null,
    segment: input.segment ?? null,
    metadata: input.metadata ?? {},
  };
}

module.exports = { createChannelTenantIdentity };
