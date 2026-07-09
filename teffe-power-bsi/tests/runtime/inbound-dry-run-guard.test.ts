const assert = require('assert');
const { InboundDryRunGuard } = require('../../src/runtime/dry-run/InboundDryRunGuard.ts');

function run() {
  const enabled = new InboundDryRunGuard({ enabled: true, sendEnabled: false });
  const boot = enabled.assertBootAllowed();
  assert.strictEqual(boot.enabled, true);
  assert.strictEqual(boot.outboundBlocked, true);

  const sendEnabled = new InboundDryRunGuard({ enabled: true, sendEnabled: true });
  const rejected = sendEnabled.assertBootAllowed();
  assert.strictEqual(rejected.processingFailed, true);
  assert.strictEqual(rejected.outboundBlocked, false);
  assert.strictEqual(rejected.reason, 'real_send_must_remain_disabled');

  const result = enabled.evaluate({ status: 'processed', outboundBlocked: false });
  assert.strictEqual(result.outboundBlocked, true);

  return { name: 'inbound-dry-run-guard', pass: true };
}

module.exports = { run };
