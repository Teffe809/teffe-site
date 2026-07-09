const assert = require('assert');
const { createRuntime, sign, whatsappPayload } = require('./webhook-test-utils.ts');

function run() {
  const { runtime, platform } = createRuntime();
  const rawBody = JSON.stringify(whatsappPayload());
  const response = runtime.handle({
    method: 'POST',
    provider: 'whatsapp-cloud',
    headers: {
      'x-hub-signature-256': sign(rawBody),
    },
    rawBody,
  });

  assert.strictEqual(response.statusCode, 200);
  assert.strictEqual(response.body.ok, true);
  assert.strictEqual(response.body.tenantId, 'autopecas');
  assert.strictEqual(response.body.channel, 'whatsapp');
  assert.strictEqual(response.body.workflow, 'autoparts.full-sales-flow');
  assert.strictEqual(response.body.delivery.ok, true);
  assert(platform.engines.memoryEngine.latestWorkflow().ok);

  return { name: 'webhook-runtime-inbound', pass: true };
}

module.exports = { run };
