const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootPlatform } = require('../platform');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readContext(dataDir) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, 'context-store.json'), 'utf8'));
}

function fileSize(dataDir) {
  return fs.statSync(path.join(dataDir, 'context-store.json')).size;
}

function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-memory-retention-'));
  const platform = bootPlatform({
    dataDir,
    memoryRetention: {
      maxPayloadBytes: 512,
      maxStringLength: 120,
      maxRecordsPerCollection: {
        executions: 3,
        workflows: 2,
        communications: 3,
        dispatches: 3,
        understandings: 3,
      },
      maxRecordsPerTenant: 2,
      maxRecordsPerConversation: 2,
    },
  });
  const { memoryEngine, miaCore } = platform.engines;

  assert(platform.status === 'ok', 'platform boot failed');

  const vehicle = miaCore.handleManualVehicleIdentification({
    plate: 'ABC-1D23',
    userId: 'memory-retention-user',
  });
  assert(vehicle.ok === true, 'capability regression failed before retention checks');

  memoryEngine.persistExecution({
    id: 'exec_large',
    capability: 'memory.retention.fixture',
    input: { text: 'x'.repeat(2048) },
    result: {
      payload: 'y'.repeat(4096),
      nested: {
        value: 'z'.repeat(4096),
      },
    },
    auditId: 'audit_large',
    timestamp: new Date().toISOString(),
    tenantId: 'autopecas',
    conversationId: 'conversation-a',
    executionContext: {
      tenant: { id: 'autopecas' },
      user: { id: 'memory-retention-user' },
      memory: {
        latestExecution: {
          id: 'exec_previous',
          capability: 'vehicle.compatibility',
          auditId: 'audit_previous',
          timestamp: '2026-07-09T00:00:00.000Z',
          result: { shouldNotPersist: 'nested execution payload' },
        },
      },
      runtime: {
        source: 'memory-retention-validation',
        intent: 'memory.retention',
        ai: false,
      },
      services: {
        transient: true,
      },
    },
  });

  for (let index = 0; index < 5; index += 1) {
    memoryEngine.persistCommunication({
      id: `message_${index}`,
      tenantId: 'autopecas',
      conversationId: 'conversation-a',
      channel: 'web',
      type: 'text',
      payload: {
        text: `Mensagem ${index} ${'m'.repeat(1024)}`,
      },
      metadata: {
        index,
      },
      timestamp: new Date().toISOString(),
      auditId: `audit_message_${index}`,
    });
  }

  for (let index = 0; index < 4; index += 1) {
    memoryEngine.persistWorkflow({
      id: `workflow_${index}`,
      workflow: 'autoparts.full-sales-flow',
      tenantId: 'autopecas',
      conversationId: 'conversation-a',
      ok: true,
      steps: [{ name: 'fixture', ok: true }],
      result: {
        payload: 'w'.repeat(2048),
      },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      completedAuditId: `audit_workflow_${index}`,
    });
  }

  const beforeManualCompactBytes = fileSize(dataDir);
  const compactStats = memoryEngine.compactNow();
  const afterManualCompactBytes = fileSize(dataDir);
  const context = readContext(dataDir);

  assert(context.executions.length <= 3, 'execution retention limit was not applied');
  assert(context.communications.length <= 2, 'tenant/conversation communication limit was not applied');
  assert(context.workflows.length <= 2, 'workflow retention limit was not applied');

  const latestExecution = memoryEngine.latestExecution();
  assert(latestExecution.capability, 'latest execution essential capability missing');
  assert(latestExecution.auditId, 'latest execution audit reference missing');
  assert(latestExecution.executionContext.runtime.intent, 'runtime intent missing after compaction');
  assert(
    latestExecution.executionContext.memory.latestExecution.result == null,
    'nested execution payload leaked through memory reference'
  );
  assert(latestExecution.executionContext.services == null, 'runtime services leaked into memory');

  const compactedExecution = context.executions.find(({ id }) => id === 'exec_large');
  assert(compactedExecution, 'large execution fixture was unexpectedly removed');
  assert(compactedExecution.result.payload.compacted === true, 'large result payload was not compacted');
  assert(
    compactedExecution.result.nested.value.compacted === true,
    'large nested result payload was not compacted'
  );
  assert(compactedExecution.input.text.compacted === true, 'large input string was not compacted');

  const retainedCommunication = context.communications.at(-1);
  assert(retainedCommunication.id === 'message_4', 'retention did not preserve newest communication');
  assert(
    retainedCommunication.payload.text.compacted === true,
    'large communication text was not compacted'
  );

  const secondVehicle = miaCore.handleManualVehicleIdentification({
    plate: 'XYZ-9A88',
    userId: 'memory-retention-user',
  });
  assert(secondVehicle.ok === true, 'capability regression failed after compaction');
  assert(memoryEngine.latestExecution().result.vehicle.plate === 'XYZ9A88', 'latest result mismatch');

  console.log(JSON.stringify({
    pass: true,
    module: 'Memory Retention / Context Compaction',
    retention: {
      strategy: compactStats.strategy,
      compactedPayloads: compactStats.compactedPayloads,
      truncatedStrings: compactStats.truncatedStrings,
      removedRecords: compactStats.removedRecords,
      collections: compactStats.collections,
    },
    memorySize: {
      beforeManualCompactBytes,
      afterManualCompactBytes,
      compactStatsBeforeBytes: compactStats.beforeBytes,
      compactStatsAfterBytes: compactStats.afterBytes,
    },
    essentialData: {
      latestCapability: memoryEngine.latestExecution().capability,
      latestAuditId: memoryEngine.latestExecution().auditId,
      latestVehicle: memoryEngine.latestExecution().result.vehicle.plate,
      latestMemoryReference: memoryEngine.latestExecution().executionContext.memory.latestExecution,
    },
    coverage: {
      contextCompaction: true,
      retentionLimits: true,
      largePayload: true,
      essentialDataPreserved: true,
      recursionAvoided: true,
      capabilityRegression: true,
      noExternalApi: true,
      noAi: true,
    },
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ pass: false, error: error.message }, null, 2));
  process.exit(1);
}
