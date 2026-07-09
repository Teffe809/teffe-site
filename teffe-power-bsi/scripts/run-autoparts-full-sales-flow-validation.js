const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { bootPlatform } = require('../platform');

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

async function validateHttp() {
  const port = 39000 + (process.pid % 1000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const success = await fetch(`http://127.0.0.1:${port}/workflows/autoparts/full-sales-flow`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        plate: 'ABC-1D23',
        category: 'suspensao',
        userId: 'http-autoparts-flow-user',
      }),
    });
    const successBody = await success.json();
    assert(success.status === 200, `expected HTTP 200, got ${success.status}`);
    assert(successBody.ok === true, 'HTTP full sales flow success missing');
    assert(successBody.workflow === 'autoparts.full-sales-flow', 'HTTP workflow id mismatch');
    assert(successBody.steps.length === 9, 'HTTP workflow step count mismatch');

    const failure = await fetch(`http://127.0.0.1:${port}/workflows/autoparts/full-sales-flow`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        plate: 'ABC-1D23',
        category: 'lataria',
      }),
    });
    const failureBody = await failure.json();
    assert(failure.status === 400, `expected HTTP 400, got ${failure.status}`);
    assert(failureBody.ok === false, 'HTTP full sales flow failure missing');
    assert(failureBody.failedStep === 'vehicle-compatibility', 'HTTP failed step mismatch');

    return {
      endpoint: '/workflows/autoparts/full-sales-flow',
      successStatus: success.status,
      failureStatus: failure.status,
    };
  } finally {
    child.kill();
  }
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-autoparts-flow-'));
  const platform = bootPlatform({ dataDir });
  const { miaCore } = platform.engines;

  assert(platform.status === 'ok', 'platform boot failed');
  assert(platform.capabilities.length === 9, 'capability regression count mismatch');

  const success = miaCore.handleAutopartsFullSalesFlow({
    plate: 'ABC-1D23',
    category: 'suspensao',
    userId: 'autoparts-flow-validation-user',
  });

  assert(success.ok === true, 'full sales flow failed');
  assert(success.workflow === 'autoparts.full-sales-flow', 'workflow id mismatch');
  assert(success.steps.length === 9, 'workflow must execute nine steps');
  assert(success.steps.every(({ ok }) => ok === true), 'all workflow steps must pass');
  assert(success.result.vehicle.plate === 'ABC1D23', 'vehicle output mismatch');
  assert(success.result.category === 'suspensao', 'category output mismatch');
  assert(success.result.part.internalCode === 'TFF-SUS-001', 'selected part mismatch');
  assert(success.result.stock.available === true, 'stock output mismatch');
  assert(success.result.serviceIntelligence.source === 'domain-knowledge-engine', 'service source mismatch');
  assert(
    success.result.recommendation.source === 'service-intelligence+domain-knowledge-engine',
    'recommendation source mismatch'
  );
  assert(
    success.result.budget.source === 'service-intelligence+recommendation-engine+domain-knowledge-engine',
    'budget source mismatch'
  );
  assert(success.result.pricing.source === 'budget-intelligence', 'pricing source mismatch');
  assert(success.result.decision.source === 'pricing-intelligence', 'decision source mismatch');
  assert(
    success.result.sales.source === 'decision-rules-engine+library-registry',
    'sales source mismatch'
  );

  const intermediateFailure = miaCore.handleAutopartsFullSalesFlow({
    plate: 'ABC-1D23',
    category: 'lataria',
    userId: 'autoparts-flow-validation-user',
  });
  assert(intermediateFailure.ok === false, 'unsupported category must fail');
  assert(intermediateFailure.failedStep === 'vehicle-compatibility', 'intermediate failure step mismatch');
  assert(
    intermediateFailure.error?.code === 'category_not_supported',
    'intermediate failure code mismatch'
  );
  assert(intermediateFailure.steps.length === 2, 'intermediate failure should stop after compatibility');

  const missingVehicle = miaCore.handleAutopartsFullSalesFlow({
    category: 'suspensao',
  });
  assert(missingVehicle.ok === false, 'missing vehicle must fail');
  assert(missingVehicle.failedStep === 'request.validation', 'missing vehicle failure step mismatch');
  assert(missingVehicle.error?.code === 'vehicle_required', 'missing vehicle error mismatch');
  assert(missingVehicle.steps.length === 0, 'missing vehicle must not execute capabilities');

  const missingPart = miaCore.handleAutopartsFullSalesFlow({
    plate: 'ABC-1D23',
  });
  assert(missingPart.ok === false, 'missing part must fail');
  assert(missingPart.failedStep === 'request.validation', 'missing part failure step mismatch');
  assert(missingPart.error?.code === 'part_required', 'missing part error mismatch');
  assert(missingPart.steps.length === 0, 'missing part must not execute capabilities');

  const persistedContext = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'context-store.json'), 'utf8')
  );
  assert(persistedContext.executions.length === 10, 'capability execution persistence mismatch');
  assert(persistedContext.workflows.length === 4, 'workflow persistence mismatch');
  assert(persistedContext.workflows[0].ok === true, 'successful workflow not persisted');
  assert(persistedContext.workflows[1].failedStep === 'vehicle-compatibility', 'failed workflow not persisted');
  assert(
    persistedContext.executions.every((execution) =>
      execution.executionContext.workflow?.id === 'autoparts.full-sales-flow'
    ),
    'execution context workflow id not preserved'
  );

  const auditLines = fs.readFileSync(path.join(dataDir, 'audit.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const workflowStarted = auditLines.filter((entry) => entry.type === 'workflow.execution.started');
  const workflowCompleted = auditLines.filter((entry) => entry.type === 'workflow.execution.completed');
  const workflowFailed = auditLines.filter((entry) => entry.type === 'workflow.execution.failed');
  const capabilityStarted = auditLines.filter((entry) => entry.type === 'capability.execution.started');
  const capabilityDenied = auditLines.filter((entry) => entry.type === 'capability.execution.denied');
  assert(workflowStarted.length === 4, 'workflow started audit count mismatch');
  assert(workflowCompleted.length === 1, 'workflow completed audit count mismatch');
  assert(workflowFailed.length === 3, 'workflow failed audit count mismatch');
  assert(capabilityStarted.length === 10, 'capability step audit count mismatch');
  assert(capabilityDenied.length === 1, 'capability denied audit count mismatch');

  const http = await validateHttp();

  console.log(JSON.stringify({
    pass: true,
    workflow: {
      id: success.workflow,
      runId: success.runId,
      steps: success.steps.map(({ name, ok }) => ({ name, ok })),
    },
    consolidatedResult: {
      vehicle: success.result.vehicle.plate,
      category: success.result.category,
      part: success.result.part.internalCode,
      stockAvailable: success.result.stock.available,
      budgetItems: 1 + success.result.budget.complementaryItems.length,
      pricingItems: success.result.pricing.items.length,
      decisions: success.result.decision.decisions.length,
      salesPriority: success.result.sales.commercialPriority,
    },
    negativeTests: [
      intermediateFailure,
      missingVehicle,
      missingPart,
    ].map(({ ok, failedStep, error, auditId }) => ({ ok, failedStep, error, auditId })),
    coverage: {
      fullPositiveFlow: true,
      intermediateFailure: true,
      missingVehicle: true,
      missingPart: true,
      executionContext: true,
      audit: true,
      memory: true,
      http: true,
      noErp: true,
      noExternalApi: true,
      noAi: true,
    },
    audit: {
      workflowStarted: workflowStarted.length,
      workflowCompleted: workflowCompleted.length,
      workflowFailed: workflowFailed.length,
      capabilityStarted: capabilityStarted.length,
      capabilityDenied: capabilityDenied.length,
    },
    memory: {
      workflows: persistedContext.workflows.length,
      executions: persistedContext.executions.length,
    },
    http,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ pass: false, error: error.message }, null, 2));
  process.exit(1);
});
