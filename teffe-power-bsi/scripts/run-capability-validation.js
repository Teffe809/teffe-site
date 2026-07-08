const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootPlatform } = require('../platform');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFailure(platform, plate, expectedCode) {
  const response = platform.engines.miaCore.handleManualVehicleIdentification({
    plate,
    userId: 'negative-validation-user',
  });

  assert(response.ok === false, `expected failure for plate: ${plate}`);
  assert(response.error?.code === expectedCode, `expected ${expectedCode}, got ${response.error?.code}`);
  assert(response.auditId, `expected auditId for failed plate: ${plate}`);

  return response;
}

function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-capability-validation-'));
  const platform = bootPlatform({ dataDir });

  assert(platform.status === 'ok', 'platform boot failed');
  assert(platform.plugins.includes('vehicle-identification-manual'), 'vehicle plugin not loaded');
  assert(platform.engines.pluginEngine, 'Plugin Engine missing');
  assert(platform.engines.workflowEngine, 'Workflow Engine missing');
  assert(platform.engines.memoryEngine, 'Memory Engine missing');
  assert(platform.engines.securityGuardian, 'Security Guardian missing');
  assert(platform.engines.miaCore, 'MIA Core missing');
  assert(platform.engines.auditLog, 'Audit Log missing');
  assert(platform.engines.capabilityPipeline, 'Capability Pipeline missing');
  assert(platform.engines.capabilityRegistry, 'Capability Registry missing');
  assert(platform.engines.capabilityDiscovery, 'Capability Discovery missing');
  assert(platform.engines.contractValidator, 'Contract Validator missing');
  assert(platform.engines.capabilityRegistry.has('vehicle-identification.manual'), 'Vehicle capability not registered');

  const discoveredById = platform.engines.capabilityDiscovery.findById('vehicle-identification.manual');
  const discoveredByMetadata = platform.engines.capabilityDiscovery.findByMetadata({
    name: 'Vehicle Identification Manual',
  });

  assert(discoveredById?.pluginId === 'vehicle-identification-manual', 'Vehicle capability plugin mapping missing');
  assert(discoveredById?.inputContract?.required?.includes('plate'), 'Vehicle input contract missing plate');
  assert(discoveredById?.outputContract?.success?.normalizedPlate === 'string', 'Vehicle output contract missing normalizedPlate');
  assert(discoveredByMetadata.length === 1, 'Vehicle capability discovery by metadata failed');

  const response = platform.engines.miaCore.handleManualVehicleIdentification({
    plate: 'ABC-1D23',
    userId: 'validation-user',
  });

  assert(response.ok === true, 'capability execution failed');
  assert(response.normalizedPlate === 'ABC1D23', 'plate was not normalized');
  assert(response.vehicle.plate === 'ABC1D23', 'vehicle plate mismatch');
  assert(response.source === 'mock', 'capability must use mock source');
  assert(response.auditId, 'success response must include auditId');
  const latestExecution = platform.engines.memoryEngine.latestExecution();
  assert(latestExecution?.result.vehicle.plate === 'ABC1D23', 'context was not persisted in memory');
  assert(latestExecution?.executionContext?.runtime?.source === 'mia-core', 'ExecutionContext runtime source missing');
  assert(latestExecution?.executionContext?.user?.id === 'validation-user', 'ExecutionContext user missing');
  assert(latestExecution?.executionContext?.runtime?.intent === 'vehicle.identify.manual', 'ExecutionContext intent missing');
  assert(latestExecution?.executionContext?.memory, 'ExecutionContext memory missing');
  assert(latestExecution?.executionContext?.audit?.startedId, 'ExecutionContext audit reference missing');
  assert(response.audit.started.executionContext.runtime.source === 'mia-core', 'audit missing ExecutionContext');

  const negativeTests = [
    assertFailure(platform, '', 'plate_required'),
    assertFailure(platform, 'ABC123', 'plate_too_short'),
    assertFailure(platform, 'ABC12345', 'plate_too_long'),
    assertFailure(platform, 'ABC@123', 'plate_invalid_characters'),
    assertFailure(platform, '123ABCD', 'plate_invalid_format'),
  ];

  const invalidInputContract = platform.engines.miaCore.handleManualVehicleIdentification({
    plate: 1234567,
    userId: 'contract-validation-user',
  });
  assert(invalidInputContract.ok === false, 'invalid input contract must fail');
  assert(
    invalidInputContract.error?.code === 'capability_input_contract_invalid',
    'invalid input contract error code mismatch'
  );

  const invalidRequestContract = platform.engines.capabilityPipeline.run({
    capability: 'vehicle-identification.manual',
    input: { plate: 'ABC1D23' },
  }, {
    validate: () => {
      throw new Error('business validation must not run for an invalid request contract');
    },
  });
  assert(invalidRequestContract.ok === false, 'invalid CapabilityRequest must fail');
  assert(
    invalidRequestContract.error?.code === 'capability_request_contract_invalid',
    'invalid CapabilityRequest error code mismatch'
  );

  const vehiclePlugin = platform.engines.pluginEngine.plugins.get('vehicle-identification-manual');
  const originalExecute = vehiclePlugin.execute;
  vehiclePlugin.execute = () => ({ source: 'mock' });
  const invalidResultContract = platform.engines.miaCore.handleManualVehicleIdentification({
    plate: 'ABC1D23',
    userId: 'contract-validation-user',
  });
  vehiclePlugin.execute = originalExecute;
  assert(invalidResultContract.ok === false, 'invalid capability result must fail');
  assert(
    invalidResultContract.error?.code === 'capability_result_contract_invalid',
    'invalid capability result error code mismatch'
  );

  const auditFile = path.join(dataDir, 'audit.jsonl');
  const contextFile = path.join(dataDir, 'context-store.json');
  const auditLines = fs.readFileSync(auditFile, 'utf8').trim().split('\n');
  const persistedContext = JSON.parse(fs.readFileSync(contextFile, 'utf8'));

  assert(auditLines.length >= 11, 'audit records were not written');
  assert(persistedContext.executions.length === 1, 'memory context execution count mismatch');

  console.log(JSON.stringify({
    pass: true,
    platform: {
      status: platform.status,
      plugins: platform.plugins,
      engines: [
        'Plugin Engine',
        'Workflow Engine',
        'Memory Engine',
        'Security Guardian',
        'MIA Core',
        'Audit Log',
        'Capability Pipeline',
        'Capability Registry',
        'Capability Discovery',
        'Contract Validator',
      ],
      capabilities: platform.capabilities.map((capability) => ({
        id: capability.id,
        name: capability.name,
        version: capability.version,
        pluginId: capability.pluginId,
      })),
    },
    input: {
      plate: 'ABC-1D23',
    },
    result: {
      ok: response.ok,
      normalizedPlate: response.normalizedPlate,
      vehicle: response.vehicle,
      auditId: response.auditId,
    },
    negativeTests: negativeTests.map((test) => ({
      ok: test.ok,
      normalizedPlate: test.normalizedPlate,
      error: test.error,
      auditId: test.auditId,
    })),
    contractTests: [
      invalidInputContract,
      invalidRequestContract,
      invalidResultContract,
    ].map((test) => ({
      ok: test.ok,
      error: test.error,
      auditId: test.auditId,
    })),
    audit: {
      records: auditLines.length,
      file: auditFile,
    },
    memory: {
      executions: persistedContext.executions.length,
      file: contextFile,
    },
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    pass: false,
    error: error.message,
  }, null, 2));
  process.exit(1);
}
