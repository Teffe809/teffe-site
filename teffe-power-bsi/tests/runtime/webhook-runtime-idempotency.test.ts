const assert = require('assert');
const { createRuntime, sign, whatsappPayload } = require('./webhook-test-utils.ts');

function run() {
  const { runtime, platform } = createRuntime();
  const rawBody = JSON.stringify(whatsappPayload());
  const headers = { 'x-hub-signature-256': sign(rawBody) };

  const first = runtime.handle({ method: 'POST', provider: 'whatsapp-cloud', headers, rawBody });
  assert.strictEqual(first.statusCode, 200);
  assert.strictEqual(first.body.idempotency.firstSeen, true);
  const workflowsAfterFirst = platform.engines.memoryEngine.context.workflows.length;

  const duplicate = runtime.handle({ method: 'POST', provider: 'whatsapp-cloud', headers, rawBody });
  assert.strictEqual(duplicate.statusCode, 200);
  assert.strictEqual(duplicate.body.duplicate, true);
  assert.strictEqual(platform.engines.memoryEngine.context.workflows.length, workflowsAfterFirst);

  const withoutMessageIdPayload = whatsappPayload();
  delete withoutMessageIdPayload.entry[0].changes[0].value.messages[0].id;
  const missingRawBody = JSON.stringify(withoutMessageIdPayload);
  const missing = runtime.handle({
    method: 'POST',
    provider: 'whatsapp-cloud',
    headers: { 'x-hub-signature-256': sign(missingRawBody) },
    rawBody: missingRawBody,
  });
  assert.strictEqual(missing.statusCode, 202);
  assert.strictEqual(missing.body.error.code, 'message_id_missing');

  return { name: 'webhook-runtime-idempotency', pass: true };
}

module.exports = { run };
