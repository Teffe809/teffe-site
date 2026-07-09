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

async function validateHttp(vehicle) {
  const port = 32000 + (process.pid % 1000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      TEFFE_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-http-compatibility-')),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const success = await fetch(`http://127.0.0.1:${port}/capabilities/vehicle-compatibility`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        vehicle,
        category: 'filtros',
        userId: 'http-validation-user',
      }),
    });
    const successBody = await success.json();
    assert(success.status === 200, `expected HTTP 200, got ${success.status}`);
    assert(successBody.ok === true, 'HTTP capability success response missing');
    assert(successBody.compatibleParts.length === 2, 'HTTP compatible parts mismatch');

    const failure = await fetch(`http://127.0.0.1:${port}/capabilities/vehicle-compatibility`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vehicle, category: 'pneus' }),
    });
    const failureBody = await failure.json();
    assert(failure.status === 400, `expected HTTP 400, got ${failure.status}`);
    assert(failureBody.error?.code === 'category_not_supported', 'HTTP failure contract mismatch');

    return {
      endpoint: '/capabilities/vehicle-compatibility',
      successStatus: success.status,
      failureStatus: failure.status,
    };
  } finally {
    child.kill();
  }
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-compatibility-validation-'));
  const platform = bootPlatform({ dataDir });

  assert(platform.status === 'ok', 'platform boot failed');
  assert(platform.plugins.includes('vehicle-identification-manual'), 'identification plugin not loaded');
  assert(platform.plugins.includes('vehicle-compatibility'), 'compatibility plugin not loaded');
  assert(platform.capabilities.length >= 2, 'expected vehicle capabilities to be registered');
  assert(platform.engines.capabilityRegistry.has('vehicle.compatibility'), 'compatibility not registered');

  const discovered = platform.engines.capabilityDiscovery.findById('vehicle.compatibility');
  assert(discovered?.pluginId === 'vehicle-compatibility', 'compatibility plugin mapping missing');
  assert(discovered?.inputContract?.required?.includes('vehicle'), 'vehicle input contract missing');
  assert(discovered?.resultContract?.properties?.compatibleParts?.items, 'parts result contract missing');

  const identification = platform.engines.miaCore.handleManualVehicleIdentification({
    plate: 'ABC-1D23',
    userId: 'compatibility-validation-user',
  });
  assert(identification.ok === true, 'vehicle identification failed');

  const compatibility = platform.engines.miaCore.handleVehicleCompatibility({
    vehicle: identification.vehicle,
    category: 'Suspens\u00e3o',
    userId: 'compatibility-validation-user',
  });
  assert(compatibility.ok === true, 'vehicle compatibility failed');
  assert(compatibility.category === 'suspensao', 'category was not normalized');
  assert(compatibility.compatibleParts.length === 1, 'compatible parts count mismatch');
  assert(compatibility.compatibleParts[0].manufacturer === 'Cofap', 'manufacturer mismatch');
  assert(compatibility.compatibleParts[0].internalCode === 'TFF-SUS-001', 'internal code mismatch');
  assert(compatibility.compatibleParts[0].technicalNotes, 'technical notes missing');
  assert(compatibility.source === 'mock', 'compatibility must use mock source');
  assert(compatibility.auditId, 'compatibility auditId missing');

  const latestExecution = platform.engines.memoryEngine.latestExecution();
  assert(latestExecution.capability === 'vehicle.compatibility', 'compatibility context not persisted');
  assert(latestExecution.executionContext.runtime.intent === 'vehicle.compatibility', 'runtime intent missing');
  assert(latestExecution.executionContext.user.id === 'compatibility-validation-user', 'runtime user missing');

  const unsupportedCategory = platform.engines.miaCore.handleVehicleCompatibility({
    vehicle: identification.vehicle,
    category: 'pneus',
  });
  assert(unsupportedCategory.ok === false, 'unsupported category must fail');
  assert(unsupportedCategory.error?.code === 'category_not_supported', 'unsupported category code mismatch');

  const missingVehicle = platform.engines.miaCore.handleVehicleCompatibility({
    category: 'freios',
  });
  assert(missingVehicle.ok === false, 'missing vehicle must fail');
  assert(
    missingVehicle.error?.code === 'capability_input_contract_invalid',
    'missing vehicle contract code mismatch'
  );

  const invalidVehicle = platform.engines.miaCore.handleVehicleCompatibility({
    vehicle: { plate: 'ABC1D23', brand: 'Toyota', year: 2022 },
    category: 'motor',
  });
  assert(invalidVehicle.ok === false, 'invalid vehicle must fail');
  assert(
    invalidVehicle.error?.code === 'capability_input_contract_invalid',
    'invalid vehicle contract code mismatch'
  );

  const compatibilityPlugin = platform.engines.pluginEngine.plugins.get('vehicle-compatibility');
  const originalExecute = compatibilityPlugin.execute;
  compatibilityPlugin.execute = (input) => ({
    source: 'mock',
    vehicle: input.vehicle,
    category: input.category,
    compatibleParts: [{
      name: 'Invalid mock part',
      internalCode: 'TFF-INVALID',
      technicalNotes: 'Missing manufacturer for contract validation.',
    }],
  });
  const invalidResult = platform.engines.miaCore.handleVehicleCompatibility({
    vehicle: identification.vehicle,
    category: 'filtros',
  });
  compatibilityPlugin.execute = originalExecute;
  assert(invalidResult.ok === false, 'invalid compatibility result must fail');
  assert(
    invalidResult.error?.code === 'capability_result_contract_invalid',
    'invalid compatibility result contract code mismatch'
  );

  const persistedContext = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'context-store.json'), 'utf8')
  );
  assert(persistedContext.executions.length === 2, 'only two successful executions must persist');

  const http = await validateHttp(identification.vehicle);

  console.log(JSON.stringify({
    pass: true,
    platform: {
      plugins: platform.plugins,
      capabilities: platform.capabilities.map(({ id, pluginId }) => ({ id, pluginId })),
    },
    result: {
      category: compatibility.category,
      compatibleParts: compatibility.compatibleParts,
      auditId: compatibility.auditId,
    },
    negativeTests: [
      unsupportedCategory,
      missingVehicle,
      invalidVehicle,
      invalidResult,
    ].map(({ ok, error, auditId }) => ({ ok, error, auditId })),
    memory: {
      executions: persistedContext.executions.length,
    },
    http,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    pass: false,
    error: error.message,
  }, null, 2));
  process.exit(1);
});
