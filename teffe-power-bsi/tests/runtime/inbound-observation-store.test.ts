const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FileInboundObservationStore } = require('../../src/runtime/observation/FileInboundObservationStore.ts');
const { InboundObservationService } = require('../../src/runtime/observation/InboundObservationService.ts');

function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-observation-test-'));
  const filePath = path.join(dir, 'inbound-observations.jsonl');
  const service = new InboundObservationService({
    store: new FileInboundObservationStore({ filePath }),
  });

  const record = service.record({
    provider: 'whatsapp-cloud',
    channel: 'whatsapp',
    tenantId: 'autopecas',
    messageId: 'wamid.long-realistic-message-id',
    sender: '+5511999990001',
    messageType: 'text',
    signature: 'valid',
    parser: 'accepted',
    idempotency: 'first_seen',
    workflow: 'autoparts.full-sales-flow',
    processing: 'processed',
    outboundBlocked: true,
    outboundReason: 'real_send_blocked',
    rawBody: '{"must":"not persist"}',
    appSecret: 'private-placeholder',
  });

  const raw = fs.readFileSync(filePath, 'utf8');
  const persisted = JSON.parse(raw.trim());
  assert.strictEqual(record.sender, '+55******01');
  assert.strictEqual(persisted.sender, '+55******01');
  assert.strictEqual(persisted.messageId, 'wamid.***e-id');
  assert(!raw.includes('+5511999990001'));
  assert(!raw.includes('private-placeholder'));
  assert(!raw.includes('must'));
  assert.strictEqual(persisted.outbound.blocked, true);

  return { name: 'inbound-observation-store', pass: true };
}

module.exports = { run };
