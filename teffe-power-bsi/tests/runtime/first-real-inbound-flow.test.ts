const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { InboundDryRunGuard } = require('../../src/runtime/dry-run/InboundDryRunGuard.ts');
const { InMemoryIdempotencyStore } = require('../../src/runtime/idempotency/InMemoryIdempotencyStore.ts');
const { FileInboundObservationStore } = require('../../src/runtime/observation/FileInboundObservationStore.ts');
const { InboundObservationService } = require('../../src/runtime/observation/InboundObservationService.ts');
const { createRuntime, sign, whatsappPayload } = require('./webhook-test-utils.ts');

function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-first-inbound-test-'));
  const observationFile = path.join(dir, 'inbound-observations.jsonl');
  const observationService = new InboundObservationService({
    store: new FileInboundObservationStore({ filePath: observationFile }),
  });
  const idempotencyStore = new InMemoryIdempotencyStore();
  const { runtime, platform } = createRuntime({
    idempotencyStore,
    observationService,
    dryRunGuard: new InboundDryRunGuard({ enabled: true, sendEnabled: false }),
    runtimeConfig: { inboundDryRun: true, whatsappSendEnabled: false },
  });

  const rawBody = JSON.stringify(whatsappPayload('ABC-1D23 preciso de pastilha de freio'));
  const validResponse = runtime.handle({
    method: 'POST',
    provider: 'whatsapp-cloud',
    headers: { 'x-hub-signature-256': sign(rawBody) },
    rawBody,
  });
  assert.strictEqual(validResponse.statusCode, 200);
  assert.strictEqual(validResponse.body.ok, true);
  assert.strictEqual(validResponse.body.tenantId, 'autopecas');
  assert.strictEqual(validResponse.body.workflow, 'autoparts.full-sales-flow');
  assert.strictEqual(validResponse.body.delivery.status, 'blocked');
  assert(platform.engines.memoryEngine.latestWorkflow().ok);

  const duplicateResponse = runtime.handle({
    method: 'POST',
    provider: 'whatsapp-cloud',
    headers: { 'x-hub-signature-256': sign(rawBody) },
    rawBody,
  });
  assert.strictEqual(duplicateResponse.statusCode, 200);
  assert.strictEqual(duplicateResponse.body.duplicate, true);

  const invalidResponse = runtime.handle({
    method: 'POST',
    provider: 'whatsapp-cloud',
    headers: { 'x-hub-signature-256': 'sha256=invalid' },
    rawBody: JSON.stringify(whatsappPayload('ABC-1D23 preciso de filtro')),
  });
  assert.strictEqual(invalidResponse.statusCode, 401);

  const statusPayload = {
    entry: [{
      changes: [{
        value: {
          metadata: { phone_number_id: 'phone-number-id-1' },
          statuses: [{ id: 'wamid.status', status: 'delivered' }],
        },
      }],
    }],
  };
  const statusRaw = JSON.stringify(statusPayload);
  const statusResponse = runtime.handle({
    method: 'POST',
    provider: 'whatsapp-cloud',
    headers: { 'x-hub-signature-256': sign(statusRaw) },
    rawBody: statusRaw,
  });
  assert.strictEqual(statusResponse.statusCode, 200);
  assert.strictEqual(statusResponse.body.ignored, true);

  const rawObservations = fs.readFileSync(observationFile, 'utf8');
  assert(!rawObservations.includes('+5511999990001'));
  assert(!rawObservations.includes(rawBody));
  const records = rawObservations.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert(records.some((record) => record.signature === 'valid' && record.parser === 'accepted'));
  assert(records.some((record) => record.idempotency === 'duplicate' && !record.workflow));
  assert(records.some((record) => record.signature === 'signature_invalid'));
  assert(records.some((record) => record.parser === 'status_event_ignored'));
  assert(records.every((record) => record.outbound.blocked === true));

  return { name: 'first-real-inbound-flow', pass: true };
}

module.exports = { run };
