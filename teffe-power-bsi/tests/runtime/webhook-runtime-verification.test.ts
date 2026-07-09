const assert = require('assert');
const { createRuntime } = require('./webhook-test-utils.ts');

function run() {
  const { runtime } = createRuntime();
  const ok = runtime.handle({
    method: 'GET',
    provider: 'whatsapp-cloud',
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'mock-verify-value',
      'hub.challenge': 'challenge-123',
    },
  });
  assert.strictEqual(ok.statusCode, 200);
  assert.strictEqual(ok.body, 'challenge-123');

  const denied = runtime.handle({
    method: 'GET',
    provider: 'whatsapp-cloud',
    query: {
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'challenge-123',
    },
  });
  assert.strictEqual(denied.statusCode, 403);
  assert.strictEqual(denied.body.error.code, 'webhook_verification_failed');
  assert(!JSON.stringify(denied.body).includes('mock-verify-value'));

  return { name: 'webhook-runtime-verification', pass: true };
}

module.exports = { run };
