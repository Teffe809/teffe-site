const { createChannelTenantIdentity } = require('./ChannelTenantIdentity.ts');

function createChannelInboundMessage(input = {}) {
  const channel = String(input.channel ?? '').trim().toLowerCase();
  const type = String(input.type ?? '').trim().toLowerCase();
  if (!channel) throw new Error('channel is required');
  if (!type) throw new Error('message type is required');

  return {
    id: input.id ?? `channel_in_${Date.now()}`,
    channel,
    type,
    direction: 'inbound',
    tenantIdentity: createChannelTenantIdentity(input.tenantIdentity ?? input.tenant ?? {}),
    sender: normalizeParty(input.sender),
    recipient: normalizeParty(input.recipient),
    timestamp: input.timestamp
      ? new Date(input.timestamp).toISOString()
      : new Date().toISOString(),
    payload: input.payload ?? {},
    metadata: input.metadata ?? {},
    raw: input.raw ?? null,
  };
}

function normalizeParty(party = {}) {
  if (typeof party === 'string') {
    return { id: party.trim(), name: null, address: party.trim() };
  }

  const id = String(party.id ?? party.phone ?? party.email ?? party.address ?? '').trim();
  return {
    id,
    name: party.name == null ? null : String(party.name).trim(),
    address: party.address ?? party.phone ?? party.email ?? id,
  };
}

module.exports = { createChannelInboundMessage, normalizeParty };
