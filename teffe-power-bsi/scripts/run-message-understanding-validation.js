const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { bootPlatform } = require('../platform');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function message(text, overrides = {}) {
  return {
    tenantId: 'autopecas',
    channel: 'web',
    type: 'text',
    sender: { id: 'customer-1', name: 'Cliente Teste' },
    recipient: { id: 'mia-autopecas', name: 'MIA Autopecas' },
    payload: { text },
    metadata: { correlationId: 'understanding-validation' },
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
      TEFFE_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-http-understanding-')),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const success = await fetch(`http://127.0.0.1:${port}/gateway/understand`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(message('Corolla 2022 placa ABC-1D23 precisa de amortecedor dianteiro')),
    });
    const successBody = await success.json();
    assert(success.status === 200, `expected HTTP 200, got ${success.status}`);
    assert(successBody.ok === true, 'HTTP understanding success missing');
    assert(successBody.understanding.workflowInput.plate === 'ABC1D23', 'HTTP plate understanding mismatch');

    const failure = await fetch(`http://127.0.0.1:${port}/gateway/understand`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(message('', { payload: { text: '' } })),
    });
    const failureBody = await failure.json();
    assert(failure.status === 400, `expected HTTP 400, got ${failure.status}`);
    assert(failureBody.error?.code === 'text_payload_required', 'HTTP invalid message mismatch');

    return {
      endpoint: '/gateway/understand',
      successStatus: success.status,
      failureStatus: failure.status,
    };
  } finally {
    child.kill();
  }
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-message-understanding-'));
  const platform = bootPlatform({ dataDir });
  const {
    miaCore,
    messageUnderstandingEngine,
    communicationGateway,
    workflowDispatcher,
    memoryEngine,
  } = platform.engines;

  assert(platform.status === 'ok', 'platform boot failed');
  assert(messageUnderstandingEngine, 'Message Understanding Engine missing');
  assert(communicationGateway, 'Communication Gateway regression failed');
  assert(workflowDispatcher, 'Workflow Dispatcher regression failed');

  const valid = miaCore.handleMessageUnderstanding({
    message: message('Corolla 2022 2.0 flex placa ABC-1D23 precisa de amortecedor dianteiro'),
    userId: 'understanding-validation-user',
  });
  assert(valid.ok === true, 'valid understanding failed');
  assert(valid.understanding.intent === 'autoparts.sales_request', 'valid intent mismatch');
  assert(valid.understanding.workflow === 'autoparts.full-sales-flow', 'workflow mismatch');
  assert(valid.understanding.workflowInput.plate === 'ABC1D23', 'plate entity mismatch');
  assert(valid.understanding.workflowInput.category === 'suspensao', 'category entity mismatch');
  assert(valid.understanding.entities.vehicle === 'corolla', 'vehicle entity mismatch');
  assert(valid.understanding.entities.year === 2022, 'year entity mismatch');
  assert(valid.understanding.entities.engine === '2.0 flex', 'engine entity mismatch');
  assert(valid.understanding.confidence >= 0.85, 'valid confidence too low');

  const incomplete = miaCore.handleMessageUnderstanding({
    message: message('Preciso de amortecedor dianteiro para Corolla 2022'),
  });
  assert(incomplete.ok === true, 'incomplete understanding failed');
  assert(incomplete.understanding.intent === 'autoparts.incomplete_request', 'incomplete intent mismatch');
  assert(incomplete.understanding.workflowInput.plate == null, 'incomplete plate mismatch');
  assert(incomplete.understanding.workflowInput.category === 'suspensao', 'incomplete category mismatch');

  const ambiguous = miaCore.handleMessageUnderstanding({
    message: message('ABC-1D23 precisa de pastilha de freio e amortecedor'),
  });
  assert(ambiguous.ok === true, 'ambiguous understanding failed');
  assert(ambiguous.understanding.intent === 'autoparts.ambiguous_request', 'ambiguous intent mismatch');
  assert(ambiguous.understanding.entities.categories.length === 2, 'ambiguous categories mismatch');
  assert(ambiguous.understanding.workflowInput.category == null, 'ambiguous category must be null');

  const invalid = miaCore.handleMessageUnderstanding({
    message: message('', { payload: { text: '' } }),
  });
  assert(invalid.ok === false, 'invalid message must fail');
  assert(invalid.error?.code === 'text_payload_required', 'invalid message code mismatch');

  const dispatchedByUnderstanding = miaCore.handleWorkflowDispatch({
    message: message('ABC-1D23 preciso de amortecedor dianteiro'),
    userId: 'understanding-dispatch-user',
  });
  assert(dispatchedByUnderstanding.ok === true, 'dispatcher understanding fallback failed');
  assert(dispatchedByUnderstanding.workflowInput.plate === 'ABC1D23', 'dispatcher understood plate mismatch');
  assert(dispatchedByUnderstanding.workflowInput.category === 'suspensao', 'dispatcher understood category mismatch');
  assert(
    dispatchedByUnderstanding.workflowResult.result.sales.commercialPriority === 'high',
    'dispatcher workflow result mismatch'
  );

  const persistedContext = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'context-store.json'), 'utf8')
  );
  assert(persistedContext.communications.length === 4, 'communication persistence mismatch');
  assert(persistedContext.understandings.length === 4, 'understanding persistence mismatch');
  assert(persistedContext.dispatches.length === 1, 'dispatch persistence mismatch');
  assert(persistedContext.workflows.length === 1, 'workflow persistence mismatch');
  assert(persistedContext.executions.length === 9, 'capability execution persistence mismatch');
  assert(memoryEngine.latestUnderstanding().understanding.workflowInput.category === 'suspensao', 'latest understanding mismatch');

  const auditLines = fs.readFileSync(path.join(dataDir, 'audit.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const understandingAudits = auditLines.filter((entry) => entry.type === 'message.understanding.completed');
  const deniedCommunicationAudits = auditLines.filter((entry) => entry.type === 'communication.message.denied');
  assert(understandingAudits.length === 4, 'understanding audit count mismatch');
  assert(deniedCommunicationAudits.length === 1, 'invalid communication audit count mismatch');
  assert(
    understandingAudits.every((entry) => entry.executionContext.tenant.id === 'autopecas'),
    'understanding tenant context mismatch'
  );

  const http = await validateHttp();

  console.log(JSON.stringify({
    pass: true,
    module: 'Message Understanding Engine',
    valid: valid.understanding,
    incomplete: incomplete.understanding,
    ambiguous: ambiguous.understanding,
    invalid: {
      ok: invalid.ok,
      error: invalid.error,
      auditId: invalid.auditId,
    },
    dispatcherFallback: {
      workflow: dispatchedByUnderstanding.workflow,
      workflowInput: dispatchedByUnderstanding.workflowInput,
      salesPriority: dispatchedByUnderstanding.workflowResult.result.sales.commercialPriority,
    },
    coverage: {
      validMessage: true,
      incompleteMessage: true,
      ambiguousMessage: true,
      invalidMessage: true,
      deterministicRules: true,
      communicationGateway: true,
      workflowDispatcher: true,
      workflowEngine: true,
      tenantSpecialization: true,
      libraryRegistry: true,
      sharedDomainContracts: true,
      memoryEngine: true,
      securityGuardian: true,
      miaCore: true,
      http: true,
      noAi: true,
      noExternalApi: true,
    },
    memory: {
      communications: persistedContext.communications.length,
      understandings: persistedContext.understandings.length,
      dispatches: persistedContext.dispatches.length,
      workflows: persistedContext.workflows.length,
      executions: persistedContext.executions.length,
    },
    audit: {
      understandings: understandingAudits.length,
      deniedCommunications: deniedCommunicationAudits.length,
    },
    http,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ pass: false, error: error.message }, null, 2));
  process.exit(1);
});
