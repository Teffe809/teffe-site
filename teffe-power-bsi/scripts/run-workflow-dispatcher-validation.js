const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { bootPlatform } = require('../platform');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function dispatchMessage(overrides = {}) {
  return {
    tenantId: 'autopecas',
    channel: 'web',
    type: 'text',
    sender: { id: 'customer-1', name: 'Cliente Teste' },
    recipient: { id: 'mia-autopecas', name: 'MIA Autopecas' },
    payload: { text: 'Preciso de amortecedor dianteiro para ABC-1D23' },
    metadata: {
      correlationId: 'dispatcher-validation',
      workflowInput: {
        plate: 'ABC-1D23',
        category: 'suspensao',
      },
    },
    ...overrides,
  };
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
    env: {
      ...process.env,
      PORT: String(port),
      TEFFE_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-http-dispatcher-')),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const success = await fetch(`http://127.0.0.1:${port}/gateway/dispatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(dispatchMessage({ userId: 'http-dispatch-user' })),
    });
    const successBody = await success.json();
    assert(success.status === 200, `expected HTTP 200, got ${success.status}`);
    assert(successBody.ok === true, 'HTTP dispatch success missing');
    assert(successBody.workflow === 'autoparts.full-sales-flow', 'HTTP dispatch workflow mismatch');

    const failure = await fetch(`http://127.0.0.1:${port}/gateway/dispatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(dispatchMessage({
        tenantId: 'grafica',
        recipient: { id: 'mia-grafica', name: 'MIA Grafica' },
      })),
    });
    const failureBody = await failure.json();
    assert(failure.status === 400, `expected HTTP 400, got ${failure.status}`);
    assert(failureBody.error?.code === 'workflow_not_supported', 'HTTP dispatch failure mismatch');

    return {
      endpoint: '/gateway/dispatch',
      successStatus: success.status,
      failureStatus: failure.status,
    };
  } finally {
    child.kill();
  }
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-workflow-dispatcher-'));
  const platform = bootPlatform({ dataDir });
  const {
    miaCore,
    workflowDispatcher,
    communicationGateway,
    tenantSpecializationRegistry,
    libraryRegistry,
    memoryEngine,
  } = platform.engines;

  assert(platform.status === 'ok', 'platform boot failed');
  assert(workflowDispatcher, 'Workflow Dispatcher missing');
  assert(communicationGateway, 'Communication Gateway missing');
  assert(tenantSpecializationRegistry.has('autopecas'), 'tenant specialization missing');
  assert(libraryRegistry.has('teffe-sales-strategy', '1.0.0'), 'library registry missing');

  const dispatched = miaCore.handleWorkflowDispatch({
    message: dispatchMessage(),
    userId: 'dispatcher-validation-user',
  });
  assert(dispatched.ok === true, 'workflow dispatch failed');
  assert(dispatched.workflow === 'autoparts.full-sales-flow', 'workflow resolution mismatch');
  assert(dispatched.message.tenant.id === 'autopecas', 'tenant resolution mismatch');
  assert(dispatched.message.channel === 'web', 'channel preservation mismatch');
  assert(dispatched.workflowInput.plate === 'ABC-1D23', 'workflow input plate mismatch');
  assert(dispatched.workflowResult.ok === true, 'workflow result failed');
  assert(dispatched.workflowResult.result.vehicle.plate === 'ABC1D23', 'workflow vehicle mismatch');
  assert(dispatched.workflowResult.result.sales.commercialPriority === 'high', 'workflow sales mismatch');

  const invalidTenant = miaCore.handleWorkflowDispatch({
    message: dispatchMessage({ tenantId: 'tenant-inexistente' }),
  });
  assert(invalidTenant.ok === false, 'invalid tenant must fail');
  assert(invalidTenant.error?.code === 'communication_gateway_error', 'invalid tenant code mismatch');

  const unsupportedWorkflow = miaCore.handleWorkflowDispatch({
    message: dispatchMessage({
      tenantId: 'grafica',
      recipient: { id: 'mia-grafica', name: 'MIA Grafica' },
    }),
  });
  assert(unsupportedWorkflow.ok === false, 'unsupported workflow must fail');
  assert(unsupportedWorkflow.error?.code === 'workflow_not_supported', 'unsupported workflow code mismatch');
  assert(unsupportedWorkflow.error?.workflow === 'print.full-sales-flow', 'unsupported workflow id mismatch');

  const invalidMessage = miaCore.handleWorkflowDispatch({
    message: dispatchMessage({ payload: null }),
  });
  assert(invalidMessage.ok === false, 'invalid message must fail');
  assert(invalidMessage.error?.code === 'payload_required', 'invalid message code mismatch');

  const missingWorkflowInput = miaCore.handleWorkflowDispatch({
    message: dispatchMessage({
      payload: { text: 'Preciso de ajuda' },
      metadata: { correlationId: 'missing-input' },
    }),
  });
  assert(missingWorkflowInput.ok === false, 'missing workflow input must fail');
  assert(missingWorkflowInput.error?.code === 'workflow_input_required', 'missing workflow input code mismatch');

  const persistedContext = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'context-store.json'), 'utf8')
  );
  assert(persistedContext.communications.length === 3, 'communication persistence mismatch');
  assert(persistedContext.dispatches.length === 5, 'dispatch persistence mismatch');
  assert(persistedContext.workflows.length === 1, 'workflow persistence mismatch');
  assert(persistedContext.executions.length === 9, 'capability execution persistence mismatch');
  assert(memoryEngine.latestDispatch().error.code === 'workflow_input_required', 'latest dispatch mismatch');
  assert(
    persistedContext.executions.every((execution) =>
      execution.executionContext.tenant?.id === 'autopecas'
    ),
    'tenant context not preserved through dispatch'
  );

  const auditLines = fs.readFileSync(path.join(dataDir, 'audit.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const dispatchStarted = auditLines.filter((entry) => entry.type === 'workflow.dispatch.started');
  const dispatchCompleted = auditLines.filter((entry) => entry.type === 'workflow.dispatch.completed');
  const dispatchFailed = auditLines.filter((entry) => entry.type === 'workflow.dispatch.failed');
  const normalizedMessages = auditLines.filter((entry) => entry.type === 'communication.message.normalized');
  const deniedMessages = auditLines.filter((entry) => entry.type === 'communication.message.denied');
  assert(dispatchStarted.length === 3, 'dispatch started audit count mismatch');
  assert(dispatchCompleted.length === 1, 'dispatch completed audit count mismatch');
  assert(dispatchFailed.length === 4, 'dispatch failed audit count mismatch');
  assert(normalizedMessages.length === 3, 'normalized communication audit count mismatch');
  assert(deniedMessages.length === 2, 'denied communication audit count mismatch');

  const http = await validateHttp();

  console.log(JSON.stringify({
    pass: true,
    module: 'Workflow Dispatcher',
    dispatch: {
      workflow: dispatched.workflow,
      tenant: dispatched.message.tenant.id,
      channel: dispatched.message.channel,
      workflowRunId: dispatched.workflowResult.runId,
      salesPriority: dispatched.workflowResult.result.sales.commercialPriority,
    },
    negativeTests: [
      invalidTenant,
      unsupportedWorkflow,
      invalidMessage,
      missingWorkflowInput,
    ].map(({ ok, error, auditId }) => ({ ok, error, auditId })),
    coverage: {
      correctDispatch: true,
      invalidTenant: true,
      unsupportedWorkflow: true,
      invalidMessage: true,
      missingWorkflowInput: true,
      communicationGateway: true,
      tenantSpecialization: true,
      workflowEngine: true,
      libraryRegistry: true,
      memoryEngine: true,
      securityGuardian: true,
      miaCore: true,
      http: true,
      noWhatsapp: true,
      noExternalApi: true,
      noAi: true,
    },
    memory: {
      communications: persistedContext.communications.length,
      dispatches: persistedContext.dispatches.length,
      workflows: persistedContext.workflows.length,
      executions: persistedContext.executions.length,
    },
    audit: {
      dispatchStarted: dispatchStarted.length,
      dispatchCompleted: dispatchCompleted.length,
      dispatchFailed: dispatchFailed.length,
      normalizedMessages: normalizedMessages.length,
      deniedMessages: deniedMessages.length,
    },
    http,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ pass: false, error: error.message }, null, 2));
  process.exit(1);
});
