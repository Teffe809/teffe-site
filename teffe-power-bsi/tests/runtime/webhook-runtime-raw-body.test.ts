const assert = require('assert');
const { createRuntime, sign, whatsappPayload } = require('./webhook-test-utils.ts');

function run() {
  const { runtime } = createRuntime();
  const rawBody = JSON.stringify(whatsappPayload());
  const valid = runtime.handle({
    method: 'POST',
    provider: 'whatsapp-cloud',
    headers: { 'x-hub-signature-256': sign(rawBody) },
    rawBody,
  });
  assert.strictEqual(valid.statusCode, 200);

  const missingRaw = runtime.handle({
    method: 'POST',
    provider: 'whatsapp-cloud',
    headers: { 'x-hub-signature-256': sign(rawBody) },
    rawBody: '',
  });
  assert.strictEqual(missingRaw.statusCode, 400);
  assert.strictEqual(missingRaw.body.error.code, 'raw_body_required');

  const invalidSignature = runtime.handle({
    method: 'POST',
    provider: 'whatsapp-cloud',
    headers: { 'X-Hub-Signature-256': sign(rawBody, 'wrong-value') },
    rawBody,
  });
  assert.strictEqual(invalidSignature.statusCode, 401);
  assert.strictEqual(invalidSignature.body.error.code, 'signature_invalid');

  return { name: 'webhook-runtime-raw-body', pass: true };
}

module.exports = { run };
