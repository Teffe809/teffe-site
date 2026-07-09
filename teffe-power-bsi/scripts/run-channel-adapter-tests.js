const tests = [
  '../tests/channels/channel-adapter.contract.test.ts',
  '../tests/channels/mock-channel-adapter.test.ts',
  '../tests/channels/whatsapp-cloud-mapper.test.ts',
  '../tests/channels/communication-gateway-channel-flow.test.ts',
  '../tests/whatsapp-cloud/whatsapp-signature-validator.test.ts',
  '../tests/whatsapp-cloud/whatsapp-webhook-parser.test.ts',
  '../tests/whatsapp-cloud/whatsapp-delivery-guard.test.ts',
  '../tests/runtime/secret-provider.test.ts',
  '../tests/runtime/tenant-channel-config.test.ts',
  '../tests/runtime/webhook-runtime-verification.test.ts',
  '../tests/runtime/webhook-runtime-inbound.test.ts',
  '../tests/runtime/webhook-runtime-security.test.ts',
  '../tests/runtime/webhook-runtime-idempotency.test.ts',
  '../tests/runtime/webhook-runtime-raw-body.test.ts',
  '../tests/runtime/file-idempotency-store.test.ts',
  '../tests/runtime/sanitized-logger.test.ts',
  '../tests/runtime/webhook-readiness-check.test.ts',
  '../tests/runtime/inbound-observation-store.test.ts',
  '../tests/runtime/inbound-dry-run-guard.test.ts',
  '../tests/runtime/first-real-inbound-flow.test.ts',
  '../tests/runtime/first-inbound-report.test.ts',
];

try {
  const results = tests.map((testPath) => require(testPath).run());
  console.log(JSON.stringify({
    pass: true,
    suite: 'Pilot Channel Adapter Foundation',
    results,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    pass: false,
    error: error.message,
    stack: error.stack,
  }, null, 2));
  process.exit(1);
}
