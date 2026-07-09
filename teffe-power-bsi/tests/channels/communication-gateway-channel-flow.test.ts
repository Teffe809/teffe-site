const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootPlatform } = require('../../platform');
const { MockChannelAdapter } = require('../../src/channels/mock/MockChannelAdapter.ts');
const { WhatsAppCloudAdapter } = require('../../src/channels/whatsapp-cloud/WhatsAppCloudAdapter.ts');

function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-channel-flow-'));
  const platform = bootPlatform({ dataDir });
  const adapter = new MockChannelAdapter({ channel: 'whatsapp' });
  const inbound = adapter.simulateInbound({
    id: 'mock-inbound-1',
    tenantId: 'autopecas',
    channelTenantId: 'whatsapp-phone-1',
    from: '+5511999990001',
    to: '+5511888880001',
    text: 'ABC-1D23 preciso de amortecedor',
  });

  const normalized = platform.engines.communicationGateway.normalizeChannelInbound(inbound);
  assert.strictEqual(normalized.tenant.id, 'autopecas');
  assert.strictEqual(normalized.metadata.channelTenantIdentity.channelTenantId, 'whatsapp-phone-1');
  assert.strictEqual(normalized.metadata.tenantWorkflow, 'autoparts.full-sales-flow');

  const result = platform.engines.miaCore.handleChannelInbound({
    channelMessage: inbound,
    channelAdapter: adapter,
    userId: 'channel-flow-user',
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.dispatch.workflow, 'autoparts.full-sales-flow');
  assert.strictEqual(result.dispatch.workflowInput.plate, 'ABC1D23');
  assert.strictEqual(result.delivery.ok, true);
  assert.strictEqual(result.outbound.tenantIdentity.tenantId, 'autopecas');
  assert.strictEqual(result.outbound.recipient.address, '+5511999990001');
  assert.strictEqual(adapter.outbound.length, 1);

  const whatsappAdapter = new WhatsAppCloudAdapter();
  assert.strictEqual(whatsappAdapter.capabilities().businessRules, false);
  assert.strictEqual(platform.engines.workflowDispatcher.constructor.name, 'WorkflowDispatcher');

  const auditLines = fs.readFileSync(path.join(dataDir, 'audit.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert(auditLines.some((entry) => entry.type === 'channel.outbound.sent'));

  return { name: 'communication-gateway-channel-flow', pass: true };
}

module.exports = { run };
