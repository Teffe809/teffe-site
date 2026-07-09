const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { bootPlatform } = require('../platform');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function waitForServer(child, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('HTTP server startup timed out')), timeoutMs);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Teffe Power BSI')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`HTTP server exited before validation with code ${code}`));
    });
  });
}

async function validateHttp(vehicle, part) {
  const port = 34000 + (process.pid % 1000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      TEFFE_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-http-service-')),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const success = await fetch(`http://127.0.0.1:${port}/capabilities/service-intelligence`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vehicle, part, category: 'suspensao', userId: 'http-service-user' }),
    });
    const successBody = await success.json();
    assert(success.status === 200, `expected HTTP 200, got ${success.status}`);
    assert(successBody.ok === true, 'HTTP Service Intelligence success missing');
    assert(successBody.source === 'domain-knowledge-engine', 'HTTP DKE source mismatch');

    const failure = await fetch(`http://127.0.0.1:${port}/capabilities/service-intelligence`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vehicle, part, category: 'pneus' }),
    });
    const failureBody = await failure.json();
    assert(failure.status === 400, `expected HTTP 400, got ${failure.status}`);
    assert(failureBody.error?.code === 'domain_system_not_found', 'HTTP domain error mismatch');

    return {
      endpoint: '/capabilities/service-intelligence',
      successStatus: success.status,
      failureStatus: failure.status,
    };
  } finally {
    child.kill();
  }
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-service-intelligence-'));
  const platform = bootPlatform({ dataDir });
  const { miaCore, capabilityRegistry, capabilityDiscovery, domainKnowledgeEngine } = platform.engines;

  assert(platform.status === 'ok', 'platform boot failed');
  assert(platform.plugins.includes('service-intelligence'), 'Service Intelligence plugin not loaded');
  assert(capabilityRegistry.has('service.intelligence'), 'Service Intelligence not registered');

  const discovered = capabilityDiscovery.findById('service.intelligence');
  assert(discovered?.pluginId === 'service-intelligence', 'Service Intelligence plugin mapping missing');
  assert(discovered?.requirements?.includes('domainKnowledge'), 'DKE runtime requirement missing');
  assert(discovered?.inputContract?.required?.includes('part'), 'main part input contract missing');
  assert(discovered?.resultContract?.properties?.priority, 'priority result contract missing');

  const identification = miaCore.handleManualVehicleIdentification({
    plate: 'ABC-1D23',
    userId: 'service-validation-user',
  });
  assert(identification.ok === true, 'vehicle identification failed');

  const compatibility = miaCore.handleVehicleCompatibility({
    vehicle: identification.vehicle,
    category: 'suspensao',
    userId: 'service-validation-user',
  });
  assert(compatibility.ok === true, 'vehicle compatibility failed');
  const part = compatibility.compatibleParts[0];

  const expectedKnowledge = domainKnowledgeEngine.getServiceIntelligence({
    category: 'suspensao',
    component: part.name,
  });
  const service = miaCore.handleServiceIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'Suspens\u00e3o',
    userId: 'service-validation-user',
  });

  assert(service.ok === true, 'Service Intelligence execution failed');
  assert(service.category === 'suspensao', 'service category was not normalized');
  assert(service.source === 'domain-knowledge-engine', 'Service Intelligence must use DKE');
  assert(service.system.id === expectedKnowledge.system.id, 'DKE system mismatch');
  assert(
    JSON.stringify(service.relatedComponents) === JSON.stringify(expectedKnowledge.relatedComponents),
    'DKE related components mismatch'
  );
  assert(
    JSON.stringify(service.recommendations) === JSON.stringify(expectedKnowledge.recommendations),
    'DKE recommendations mismatch'
  );
  assert(service.priority === expectedKnowledge.priority, 'DKE priority mismatch');
  assert(
    service.technicalJustification === expectedKnowledge.technicalJustification,
    'DKE technical justification mismatch'
  );
  assert(service.auditId, 'Service Intelligence auditId missing');

  const persistedService = platform.engines.memoryEngine.latestExecution();
  assert(persistedService.capability === 'service.intelligence', 'service context not persisted');
  assert(persistedService.executionContext.runtime.intent === 'service.intelligence', 'service intent missing');
  assert(persistedService.executionContext.services == null, 'runtime services must not be persisted');

  const unknownSystem = miaCore.handleServiceIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'pneus',
  });
  assert(unknownSystem.ok === false, 'unknown domain system must fail');
  assert(unknownSystem.error?.code === 'domain_system_not_found', 'unknown system error mismatch');

  const invalidPart = miaCore.handleServiceIntelligence({
    vehicle: identification.vehicle,
    part: { name: 'Incomplete part' },
    category: 'suspensao',
  });
  assert(invalidPart.ok === false, 'invalid main part must fail');
  assert(
    invalidPart.error?.code === 'capability_input_contract_invalid',
    'invalid main part contract mismatch'
  );

  const invalidVehicle = miaCore.handleServiceIntelligence({
    vehicle: { plate: 'ABC1D23' },
    part,
    category: 'suspensao',
  });
  assert(invalidVehicle.ok === false, 'invalid vehicle must fail');
  assert(
    invalidVehicle.error?.code === 'capability_input_contract_invalid',
    'invalid vehicle contract mismatch'
  );

  const servicePlugin = platform.engines.pluginEngine.plugins.get('service-intelligence');
  const originalExecute = servicePlugin.execute;
  servicePlugin.execute = (input) => ({
    source: 'domain-knowledge-engine',
    vehicle: input.vehicle,
    part: input.part,
    category: input.category,
  });
  const invalidResult = miaCore.handleServiceIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
  });
  servicePlugin.execute = originalExecute;
  assert(invalidResult.ok === false, 'invalid service result must fail');
  assert(
    invalidResult.error?.code === 'capability_result_contract_invalid',
    'invalid service result contract mismatch'
  );

  const persistedContext = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'context-store.json'), 'utf8')
  );
  assert(persistedContext.executions.length === 3, 'only three successful executions must persist');
  assert(
    persistedContext.executions.every((execution) => execution.executionContext.services == null),
    'runtime DKE service leaked into persisted context'
  );

  const auditLines = fs.readFileSync(path.join(dataDir, 'audit.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const dkeAudits = auditLines.filter((entry) =>
    entry.type === 'domain.knowledge.queried' &&
    entry.capability === 'service.intelligence'
  );
  assert(dkeAudits.length === 2, 'successful and failed domain lookups must be audited');
  assert(dkeAudits.every((entry) => entry.capabilityAuditId), 'DKE capability audit link missing');

  const http = await validateHttp(identification.vehicle, part);

  console.log(JSON.stringify({
    pass: true,
    capability: {
      id: discovered.id,
      pluginId: discovered.pluginId,
      source: service.source,
    },
    result: {
      system: service.system,
      relatedComponents: service.relatedComponents.length,
      recommendations: service.recommendations,
      priority: service.priority,
      technicalJustification: service.technicalJustification,
      auditId: service.auditId,
    },
    negativeTests: [unknownSystem, invalidPart, invalidVehicle, invalidResult]
      .map(({ ok, error, auditId }) => ({ ok, error, auditId })),
    coverage: {
      registry: true,
      discovery: true,
      contracts: true,
      executionContext: true,
      domainKnowledgeEngine: true,
      audit: true,
      memory: true,
      http: true,
    },
    memory: {
      executions: persistedContext.executions.length,
    },
    audit: {
      dkeQueries: dkeAudits.length,
    },
    http,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ pass: false, error: error.message }, null, 2));
  process.exit(1);
});
