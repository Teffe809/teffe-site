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
  const port = 33000 + (process.pid % 1000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      TEFFE_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-http-stock-')),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const success = await fetch(`http://127.0.0.1:${port}/capabilities/stock-availability`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        vehicle,
        part,
        userId: 'http-stock-validation-user',
      }),
    });
    const successBody = await success.json();
    assert(success.status === 200, `expected HTTP 200, got ${success.status}`);
    assert(successBody.ok === true, 'HTTP stock success response missing');
    assert(successBody.available === true, 'HTTP stock availability mismatch');

    const failure = await fetch(`http://127.0.0.1:${port}/capabilities/stock-availability`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        vehicle,
        part: {
          ...part,
          internalCode: 'TFF-UNKNOWN',
        },
      }),
    });
    const failureBody = await failure.json();
    assert(failure.status === 400, `expected HTTP 400, got ${failure.status}`);
    assert(failureBody.error?.code === 'part_not_found', 'HTTP failure contract mismatch');

    return {
      endpoint: '/capabilities/stock-availability',
      successStatus: success.status,
      failureStatus: failure.status,
    };
  } finally {
    child.kill();
  }
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-stock-validation-'));
  const platform = bootPlatform({ dataDir });

  assert(platform.status === 'ok', 'platform boot failed');
  assert(platform.plugins.includes('stock-availability'), 'stock plugin not loaded');
  assert(platform.plugins.includes('vehicle-compatibility'), 'compatibility plugin not loaded');
  assert(platform.plugins.includes('vehicle-identification-manual'), 'identification plugin not loaded');
  assert(platform.capabilities.length >= 3, 'expected stock flow capabilities to be registered');
  assert(platform.engines.capabilityRegistry.has('stock.availability'), 'stock capability not registered');

  const discovered = platform.engines.capabilityDiscovery.findById('stock.availability');
  assert(discovered?.pluginId === 'stock-availability', 'stock plugin mapping missing');
  assert(discovered?.inputContract?.required?.includes('part'), 'stock part input contract missing');
  assert(discovered?.resultContract?.properties?.available?.type === 'boolean', 'stock result contract missing');

  const identification = platform.engines.miaCore.handleManualVehicleIdentification({
    plate: 'ABC-1D23',
    userId: 'stock-validation-user',
  });
  assert(identification.ok === true, 'vehicle identification failed');

  const compatibility = platform.engines.miaCore.handleVehicleCompatibility({
    vehicle: identification.vehicle,
    category: 'freios',
    userId: 'stock-validation-user',
  });
  assert(compatibility.ok === true, 'vehicle compatibility failed');
  assert(compatibility.compatibleParts.length === 2, 'expected two compatible brake parts');

  const availablePart = {
    ...compatibility.compatibleParts[0],
    internalCode: compatibility.compatibleParts[0].internalCode.toLowerCase(),
  };
  const availableStock = platform.engines.miaCore.handleStockAvailability({
    vehicle: identification.vehicle,
    part: availablePart,
    userId: 'stock-validation-user',
  });
  assert(availableStock.ok === true, 'available stock execution failed');
  assert(availableStock.available === true, 'part must be available');
  assert(availableStock.quantity === 12, 'available quantity mismatch');
  assert(availableStock.branch === 'Filial Centro', 'available branch mismatch');
  assert(availableStock.estimatedDelivery === 'Pronta entrega', 'delivery estimate mismatch');
  assert(availableStock.notes, 'stock notes missing');
  assert(availableStock.part.internalCode === 'TFF-FRE-001', 'internal code was not normalized');
  assert(availableStock.source === 'mock', 'stock capability must use mock source');
  assert(availableStock.auditId, 'stock auditId missing');

  const unavailableStock = platform.engines.miaCore.handleStockAvailability({
    vehicle: identification.vehicle,
    part: compatibility.compatibleParts[1],
    userId: 'stock-validation-user',
  });
  assert(unavailableStock.ok === true, 'unavailable stock lookup failed');
  assert(unavailableStock.available === false, 'part must be unavailable');
  assert(unavailableStock.quantity === 0, 'unavailable quantity must be zero');
  assert(unavailableStock.estimatedDelivery === '5 dias uteis', 'replenishment estimate mismatch');

  const latestExecution = platform.engines.memoryEngine.latestExecution();
  assert(latestExecution.capability === 'stock.availability', 'stock context not persisted');
  assert(latestExecution.executionContext.runtime.intent === 'stock.availability', 'runtime intent missing');
  assert(latestExecution.executionContext.user.id === 'stock-validation-user', 'runtime user missing');

  const unknownPart = platform.engines.miaCore.handleStockAvailability({
    vehicle: identification.vehicle,
    part: {
      ...compatibility.compatibleParts[0],
      internalCode: 'TFF-UNKNOWN',
    },
  });
  assert(unknownPart.ok === false, 'unknown part must fail');
  assert(unknownPart.error?.code === 'part_not_found', 'unknown part error code mismatch');

  const invalidPart = platform.engines.miaCore.handleStockAvailability({
    vehicle: identification.vehicle,
    part: {
      name: 'Incomplete part',
      internalCode: 'TFF-FRE-001',
      technicalNotes: 'Missing manufacturer.',
    },
  });
  assert(invalidPart.ok === false, 'invalid part must fail');
  assert(
    invalidPart.error?.code === 'capability_input_contract_invalid',
    'invalid part contract code mismatch'
  );

  const stockPlugin = platform.engines.pluginEngine.plugins.get('stock-availability');
  const originalExecute = stockPlugin.execute;
  stockPlugin.execute = (input) => ({
    source: 'mock',
    vehicle: input.vehicle,
    part: input.part,
    available: true,
    quantity: -1,
    branch: 'Invalid branch',
    estimatedDelivery: 'Invalid estimate',
    notes: 'Negative quantity for contract validation.',
  });
  const invalidResult = platform.engines.miaCore.handleStockAvailability({
    vehicle: identification.vehicle,
    part: compatibility.compatibleParts[0],
  });
  stockPlugin.execute = originalExecute;
  assert(invalidResult.ok === false, 'invalid stock result must fail');
  assert(
    invalidResult.error?.code === 'capability_result_contract_invalid',
    'invalid stock result contract code mismatch'
  );

  const persistedContext = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'context-store.json'), 'utf8')
  );
  assert(persistedContext.executions.length === 4, 'only four successful executions must persist');

  const http = await validateHttp(identification.vehicle, compatibility.compatibleParts[0]);

  console.log(JSON.stringify({
    pass: true,
    platform: {
      plugins: platform.plugins,
      capabilities: platform.capabilities.map(({ id, pluginId }) => ({ id, pluginId })),
    },
    flow: {
      vehicle: identification.vehicle,
      compatibleParts: compatibility.compatibleParts.length,
      availableStock: {
        available: availableStock.available,
        quantity: availableStock.quantity,
        branch: availableStock.branch,
        estimatedDelivery: availableStock.estimatedDelivery,
        auditId: availableStock.auditId,
      },
      unavailableStock: {
        available: unavailableStock.available,
        quantity: unavailableStock.quantity,
        estimatedDelivery: unavailableStock.estimatedDelivery,
        auditId: unavailableStock.auditId,
      },
    },
    negativeTests: [
      unknownPart,
      invalidPart,
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
