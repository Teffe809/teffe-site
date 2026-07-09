const { createChannelTenantIdentity } = require('./ChannelTenantIdentity.ts');
const { normalizeParty } = require('./ChannelInboundMessage.ts');

function createChannelOutboundMessage(input = {}) {
  const channel = String(input.channel ?? '').trim().toLowerCase();
  const type = String(input.type ?? 'text').trim().toLowerCase();
  if (!channel) throw new Error('channel is required');

  return {
    id: input.id ?? `channel_out_${Date.now()}`,
    channel,
    type,
    direction: 'outbound',
    tenantIdentity: createChannelTenantIdentity(input.tenantIdentity ?? input.tenant ?? {}),
    sender: normalizeParty(input.sender),
    recipient: normalizeParty(input.recipient),
    timestamp: input.timestamp
      ? new Date(input.timestamp).toISOString()
      : new Date().toISOString(),
    payload: input.payload ?? {},
    metadata: input.metadata ?? {},
  };
}

module.exports = { createChannelOutboundMessage };
