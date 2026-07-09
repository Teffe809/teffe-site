const tests = [
  '../tests/channels/channel-adapter.contract.test.ts',
  '../tests/channels/mock-channel-adapter.test.ts',
  '../tests/channels/whatsapp-cloud-mapper.test.ts',
  '../tests/channels/communication-gateway-channel-flow.test.ts',
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
