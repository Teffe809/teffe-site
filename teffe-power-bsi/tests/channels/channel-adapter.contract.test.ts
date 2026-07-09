const assert = require('assert');
const { ChannelAdapter } = require('../../src/channels/contracts/ChannelAdapter.ts');
const { createChannelInboundMessage } = require('../../src/channels/contracts/ChannelInboundMessage.ts');
const { createChannelOutboundMessage } = require('../../src/channels/contracts/ChannelOutboundMessage.ts');
const { createChannelDeliveryResult } = require('../../src/channels/contracts/ChannelDeliveryResult.ts');

function run() {
  const adapter = new ChannelAdapter({ channel: 'webchat', provider: 'generic' });
  assert.strictEqual(adapter.capabilities().businessRules, false);
  assert.throws(() => adapter.normalizeInbound({}), /must be implemented/);

  const inbound = createChannelInboundMessage({
    channel: 'webchat',
    type: 'text',
    tenantIdentity: { tenantId: 'autopecas', channelTenantId: 'web-1' },
    sender: 'customer-1',
    recipient: 'tenant-1',
    payload: { text: 'ABC-1D23 preciso de amortecedor' },
  });
  assert.strictEqual(inbound.direction, 'inbound');
  assert.strictEqual(inbound.tenantIdentity.tenantId, 'autopecas');

  const outbound = createChannelOutboundMessage({
    channel: 'email',
    type: 'text',
    tenantIdentity: { tenantId: 'autopecas' },
    sender: 'seller@tenant.test',
    recipient: 'customer@test.local',
    payload: { text: 'Resposta mockada' },
  });
  assert.strictEqual(outbound.direction, 'outbound');
  assert.strictEqual(outbound.channel, 'email');

  const delivery = createChannelDeliveryResult({
    ok: true,
    channel: 'instagram',
    messageId: outbound.id,
    tenantId: 'autopecas',
  });
  assert.strictEqual(delivery.status, 'sent');

  return { name: 'channel-adapter.contract', pass: true };
}

module.exports = { run };
