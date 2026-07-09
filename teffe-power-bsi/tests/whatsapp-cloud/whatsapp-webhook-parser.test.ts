const assert = require('assert');
const { WhatsAppCloudWebhookParser } = require('../../src/channels/whatsapp-cloud/WhatsAppCloudWebhookParser.ts');
const { whatsappPayload } = require('../runtime/webhook-test-utils.ts');

function run() {
  const parser = new WhatsAppCloudWebhookParser();
  const parsed = parser.parse(whatsappPayload());
  assert.strictEqual(parsed.supported, true);
  assert.strictEqual(parsed.phoneNumberId, 'phone-number-id-1');
  assert.strictEqual(parsed.messageId, 'wamid.test');
  assert.strictEqual(parsed.messageType, 'text');

  const statusEvent = parser.parse({
    entry: [{
      changes: [{
        value: {
          metadata: { phone_number_id: 'phone-number-id-1' },
          statuses: [{ id: 'wamid.status', status: 'sent' }],
        },
      }],
    }],
  });
  assert.strictEqual(statusEvent.supported, false);
  assert.strictEqual(statusEvent.reason, 'status_event_ignored');

  const unsupported = parser.parse({
    entry: [{
      changes: [{
        value: {
          metadata: { phone_number_id: 'phone-number-id-1' },
          messages: [{ id: 'wamid.unsupported', type: 'button', from: '+5511999990001' }],
        },
      }],
    }],
  });
  assert.strictEqual(unsupported.supported, false);
  assert.strictEqual(unsupported.reason, 'message_type_unsupported');

  return { name: 'whatsapp-webhook-parser', pass: true };
}

module.exports = { run };
