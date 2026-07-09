const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildFirstInboundReport } = require('../../scripts/report-first-whatsapp-inbound.js');

function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-first-report-test-'));
  const filePath = path.join(dir, 'inbound-observations.jsonl');
  const valid = {
    timestamp: '2026-07-09T12:00:00.000Z',
    provider: 'whatsapp-cloud',
    channel: 'whatsapp',
    tenantId: 'autopecas',
    messageId: 'wamid.***1234',
    sender: '+55******01',
    messageType: 'text',
    signature: 'valid',
    parser: 'accepted',
    idempotency: 'first_seen',
    workflow: 'autoparts.full-sales-flow',
    processing: 'processed',
    outbound: { blocked: true, reason: 'real_send_blocked' },
    dryRun: true,
  };
  fs.writeFileSync(filePath, `${JSON.stringify(valid)}\n`, 'utf8');
  const pass = buildFirstInboundReport({ filePath });
  assert.strictEqual(pass.ok, true);
  assert.strictEqual(pass.conclusion, 'PASS');

  const missing = buildFirstInboundReport({ filePath: path.join(dir, 'missing.jsonl') });
  assert.strictEqual(missing.ok, false);
  assert(missing.failures.includes('observation_file_missing'));

  fs.writeFileSync(filePath, `${JSON.stringify({ ...valid, outbound: { blocked: false } })}\n`, 'utf8');
  const outboundFail = buildFirstInboundReport({ filePath });
  assert.strictEqual(outboundFail.ok, false);
  assert(outboundFail.failures.includes('outbound_not_blocked'));

  fs.writeFileSync(filePath, `${JSON.stringify({ ...valid, sender: '+5511999990001' })}\n`, 'utf8');
  const sensitiveFail = buildFirstInboundReport({ filePath });
  assert.strictEqual(sensitiveFail.ok, false);
  assert(sensitiveFail.failures.includes('sensitive_data_detected'));

  fs.writeFileSync(filePath, `${JSON.stringify({ ...valid, idempotency: 'duplicate', workflow: 'autoparts.full-sales-flow' })}\n`, 'utf8');
  const duplicateFail = buildFirstInboundReport({ filePath });
  assert.strictEqual(duplicateFail.ok, false);
  assert(duplicateFail.failures.includes('duplicate_reexecuted_workflow'));

  return { name: 'first-inbound-report', pass: true };
}

module.exports = { run };
