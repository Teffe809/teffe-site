const assert = require('assert');
const { WhatsAppCloudDeliveryGuard } = require('../../src/channels/whatsapp-cloud/WhatsAppCloudDeliveryGuard.ts');
const { WhatsAppCloudAdapter } = require('../../src/channels/whatsapp-cloud/WhatsAppCloudAdapter.ts');
const { createChannelOutboundMessage } = require('../../src/channels/contracts/ChannelOutboundMessage.ts');

function run() {
  const message = createChannelOutboundMessage({
    channel: 'whatsapp',
    tenantIdentity: { tenantId: 'autopecas' },
    sender: '+5511888880001',
    recipient: '+5511999990001',
    payload: { text: 'Resposta mockada' },
  });

  const blocked = new WhatsAppCloudDeliveryGuard({ sendEnabled: false }).evaluateOutbound(message);
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.reason, 'real_send_disabled_by_feature_flag');

  const adapter = new WhatsAppCloudAdapter();
  const delivery = adapter.sendOutbound(message);
  assert.strictEqual(delivery.ok, true);
  assert.strictEqual(delivery.status, 'blocked');
  assert.strictEqual(delivery.metadata.realSendBlocked, true);
  assert(!JSON.stringify(delivery).includes('mock-app-value'));

  const allowed = new WhatsAppCloudDeliveryGuard({ sendEnabled: true }).evaluateOutbound(message);
  assert.strictEqual(allowed.allowed, true);

  return { name: 'whatsapp-delivery-guard', pass: true };
}

module.exports = { run };
