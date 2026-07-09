const assert = require('assert');
const { MockChannelAdapter } = require('../../src/channels/mock/MockChannelAdapter.ts');
const { createChannelOutboundMessage } = require('../../src/channels/contracts/ChannelOutboundMessage.ts');

function run() {
  const adapter = new MockChannelAdapter({ channel: 'whatsapp' });
  const inbound = adapter.simulateInbound({
    tenantId: 'autopecas',
    from: '+5511999990001',
    to: '+5511888880001',
    text: 'ABC-1D23 preciso de amortecedor',
  });
  assert.strictEqual(inbound.channel, 'whatsapp');
  assert.strictEqual(inbound.sender.address, '+5511999990001');
  assert.strictEqual(inbound.recipient.address, '+5511888880001');
  assert.strictEqual(inbound.tenantIdentity.tenantId, 'autopecas');

  const outbound = createChannelOutboundMessage({
    channel: 'whatsapp',
    tenantIdentity: inbound.tenantIdentity,
    sender: inbound.recipient,
    recipient: inbound.sender,
    payload: { text: 'Resposta mockada' },
  });
  const sent = adapter.sendOutbound(outbound);
  assert.strictEqual(sent.ok, true);
  assert.strictEqual(adapter.outbound.length, 1);

  const failingAdapter = new MockChannelAdapter({ channel: 'whatsapp', failSend: true });
  const failed = failingAdapter.sendOutbound(outbound);
  assert.strictEqual(failed.ok, false);
  assert.strictEqual(failed.error.code, 'mock_send_failed');
  assert.strictEqual(failingAdapter.capabilities().businessRules, false);

  return { name: 'mock-channel-adapter', pass: true };
}

module.exports = { run };
