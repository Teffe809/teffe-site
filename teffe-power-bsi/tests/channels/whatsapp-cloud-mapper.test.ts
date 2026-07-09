const assert = require('assert');
const { WhatsAppCloudMessageMapper } = require('../../src/channels/whatsapp-cloud/WhatsAppCloudMessageMapper.ts');
const { WhatsAppCloudWebhookVerifier } = require('../../src/channels/whatsapp-cloud/WhatsAppCloudWebhookVerifier.ts');

function run() {
  const mapper = new WhatsAppCloudMessageMapper({
    tenantResolver: ({ phoneNumberId }) => ({
      tenantId: 'autopecas',
      channelTenantId: phoneNumberId,
      displayName: 'MIA Autopecas',
      metadata: { source: 'test-resolver' },
    }),
  });
  const inbound = mapper.toChannelInbound({
    entry: [{
      changes: [{
        value: {
          metadata: {
            phone_number_id: 'phone-number-id-1',
            display_phone_number: '+5511888880001',
          },
          contacts: [{
            profile: { name: 'Cliente Teste' },
          }],
          messages: [{
            id: 'wamid.test',
            from: '+5511999990001',
            timestamp: '1783630000',
            type: 'text',
            text: { body: 'ABC-1D23 preciso de amortecedor' },
          }],
        },
      }],
    }],
  });

  assert.strictEqual(inbound.channel, 'whatsapp');
  assert.strictEqual(inbound.type, 'text');
  assert.strictEqual(inbound.tenantIdentity.channelTenantId, 'phone-number-id-1');
  assert.strictEqual(inbound.payload.text, 'ABC-1D23 preciso de amortecedor');

  const providerPayload = mapper.toWhatsAppOutbound({
    type: 'text',
    recipient: { id: '+5511999990001', address: '+5511999990001' },
    payload: { text: 'Resposta mockada' },
  });
  assert.strictEqual(providerPayload.messaging_product, 'whatsapp');
  assert.strictEqual(providerPayload.mock, true);
  assert.strictEqual(providerPayload.text.body, 'Resposta mockada');

  const verifier = new WhatsAppCloudWebhookVerifier();
  assert.strictEqual(verifier.verifySignature({ rawBody: '{}', signature: '', secret: null }).ok, false);
  assert.strictEqual(verifier.verifyHandshake({
    'hub.verify_token': 'verify-secret',
    'hub.challenge': '123',
  }, 'verify-secret').ok, true);

  return { name: 'whatsapp-cloud-mapper', pass: true };
}

module.exports = { run };
