const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { bootPlatform } = require('../platform');
const { MESSAGE_TYPES, PAYLOAD_CONTRACTS } = require('../platform/gateway/communication-gateway');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function baseMessage(overrides = {}) {
  return {
    tenantId: 'autopecas',
    channel: 'web',
    type: 'text',
    sender: { id: 'customer-1', name: 'Cliente Teste' },
    recipient: { id: 'mia-autopecas', name: 'MIA Autopecas' },
    timestamp: '2026-07-09T12:00:00.000Z',
    payload: { text: 'Preciso de amortecedor dianteiro' },
    metadata: { correlationId: 'comm-validation' },
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
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const success = await fetch(`http://127.0.0.1:${port}/gateway/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(baseMessage({
        userId: 'http-communication-user',
        payload: { body: 'Mensagem recebida pelo gateway HTTP' },
      })),
    });
    const successBody = await success.json();
    assert(success.status === 200, `expected HTTP 200, got ${success.status}`);
    assert(successBody.ok === true, 'HTTP communication success missing');
    assert(successBody.message.payload.text === 'Mensagem recebida pelo gateway HTTP', 'HTTP text normalization failed');

    const failure = await fetch(`http://127.0.0.1:${port}/gateway/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(baseMessage({
        type: 'video',
        payload: { url: 'https://example.test/video.mp4' },
      })),
    });
    const failureBody = await failure.json();
    assert(failure.status === 400, `expected HTTP 400, got ${failure.status}`);
    assert(failureBody.error?.code === 'message_type_not_supported', 'HTTP communication error mismatch');

    return {
      endpoint: '/gateway/messages',
      successStatus: success.status,
      failureStatus: failure.status,
    };
  } finally {
    child.kill();
  }
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-communication-gateway-'));
  const platform = bootPlatform({ dataDir });
  const {
    communicationGateway,
    miaCore,
    memoryEngine,
    tenantSpecializationRegistry,
    libraryRegistry,
  } = platform.engines;

  assert(platform.status === 'ok', 'platform boot failed');
  assert(communicationGateway, 'Communication Gateway missing');
  assert(tenantSpecializationRegistry.has('autopecas'), 'tenant specialization regression failed');
  assert(libraryRegistry.has('teffe-sales-strategy', '1.0.0'), 'library registry regression failed');
  assert(JSON.stringify(MESSAGE_TYPES) === JSON.stringify(['text', 'audio', 'image', 'document']), 'message types mismatch');
  assert(PAYLOAD_CONTRACTS.text.required.includes('text'), 'text contract missing');
  assert(PAYLOAD_CONTRACTS.audio.required.includes('url'), 'audio contract missing');
  assert(PAYLOAD_CONTRACTS.image.required.includes('url'), 'image contract missing');
  assert(PAYLOAD_CONTRACTS.document.required.includes('fileName'), 'document contract missing');

  const text = miaCore.handleCommunicationMessage({
    message: baseMessage({
      payload: { body: '  Preciso de pastilha de freio  ' },
    }),
    userId: 'communication-validation-user',
  });
  const audio = miaCore.handleCommunicationMessage({
    message: baseMessage({
      type: 'audio',
      payload: {
        url: 'https://example.test/audio.ogg',
        duration_seconds: 18,
        mime_type: 'audio/ogg',
      },
    }),
    userId: 'communication-validation-user',
  });
  const image = miaCore.handleCommunicationMessage({
    message: baseMessage({
      type: 'image',
      payload: {
        url: 'https://example.test/photo.jpg',
        mimeType: 'image/jpeg',
        caption: 'Foto da peça',
      },
    }),
    userId: 'communication-validation-user',
  });
  const document = miaCore.handleCommunicationMessage({
    message: baseMessage({
      type: 'document',
      payload: {
        url: 'https://example.test/catalogo.pdf',
        mime_type: 'application/pdf',
        file_name: 'catalogo.pdf',
      },
    }),
    userId: 'communication-validation-user',
  });

  assert(text.ok === true, 'text message failed');
  assert(audio.ok === true, 'audio message failed');
  assert(image.ok === true, 'image message failed');
  assert(document.ok === true, 'document message failed');
  assert(text.message.payload.text === 'Preciso de pastilha de freio', 'text normalization mismatch');
  assert(audio.message.payload.durationSeconds === 18, 'audio normalization mismatch');
  assert(image.message.payload.caption === 'Foto da peça', 'image normalization mismatch');
  assert(document.message.payload.fileName === 'catalogo.pdf', 'document normalization mismatch');
  assert(text.message.tenant.id === 'autopecas', 'tenant normalization mismatch');
  assert(text.message.metadata.tenantLibrary.id === 'teffe-sales-strategy', 'tenant library metadata mismatch');
  assert(text.message.metadata.tenantWorkflow === 'autoparts.full-sales-flow', 'tenant workflow metadata mismatch');

  const invalidType = miaCore.handleCommunicationMessage({
    message: baseMessage({
      type: 'video',
      payload: { url: 'https://example.test/video.mp4' },
    }),
  });
  const missingPayload = miaCore.handleCommunicationMessage({
    message: baseMessage({
      payload: null,
    }),
  });
  const invalidTenant = miaCore.handleCommunicationMessage({
    message: baseMessage({
      tenantId: 'tenant-inexistente',
    }),
  });
  const invalidAudio = miaCore.handleCommunicationMessage({
    message: baseMessage({
      type: 'audio',
      payload: {
        durationSeconds: 12,
        mimeType: 'audio/ogg',
      },
    }),
  });

  assert(invalidType.ok === false, 'invalid message type must fail');
  assert(invalidType.error?.code === 'message_type_not_supported', 'invalid type code mismatch');
  assert(missingPayload.ok === false, 'missing payload must fail');
  assert(missingPayload.error?.code === 'payload_required', 'missing payload code mismatch');
  assert(invalidTenant.ok === false, 'invalid tenant must fail');
  assert(invalidTenant.error?.code === 'communication_gateway_error', 'invalid tenant code mismatch');
  assert(invalidAudio.ok === false, 'invalid audio must fail');
  assert(invalidAudio.error?.code === 'audio_url_required', 'invalid audio code mismatch');

  const persistedContext = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'context-store.json'), 'utf8')
  );
  assert(persistedContext.communications.length === 4, 'communication persistence mismatch');
  assert(persistedContext.executions.length === 0, 'communication must not execute capabilities');
  assert(memoryEngine.latestCommunication().type === 'document', 'latest communication mismatch');

  const auditLines = fs.readFileSync(path.join(dataDir, 'audit.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const normalizedAudits = auditLines.filter((entry) => entry.type === 'communication.message.normalized');
  const deniedAudits = auditLines.filter((entry) => entry.type === 'communication.message.denied');
  assert(normalizedAudits.length === 4, 'normalized communication audit count mismatch');
  assert(deniedAudits.length === 4, 'denied communication audit count mismatch');
  assert(
    normalizedAudits.every((entry) => entry.executionContext.tenant.id === 'autopecas'),
    'communication tenant execution context missing'
  );

  const http = await validateHttp();

  console.log(JSON.stringify({
    pass: true,
    module: 'Communication Gateway',
    contracts: {
      types: MESSAGE_TYPES,
      payloads: Object.keys(PAYLOAD_CONTRACTS),
    },
    messages: {
      text: {
        tenant: text.message.tenant.id,
        channel: text.message.channel,
        payload: text.message.payload,
      },
      audio: audio.message.payload,
      image: image.message.payload,
      document: document.message.payload,
    },
    negativeTests: [
      invalidType,
      missingPayload,
      invalidTenant,
      invalidAudio,
    ].map(({ ok, error, auditId }) => ({ ok, error, auditId })),
    coverage: {
      text: true,
      audioStructure: true,
      imageStructure: true,
      documentStructure: true,
      invalidMessages: true,
      miaCore: true,
      workflowEngine: true,
      memoryEngine: true,
      securityGuardian: true,
      tenantSpecialization: true,
      libraryRegistry: true,
      http: true,
      noWhatsapp: true,
      noExternalApi: true,
      noAi: true,
    },
    memory: {
      communications: persistedContext.communications.length,
      executions: persistedContext.executions.length,
    },
    audit: {
      normalized: normalizedAudits.length,
      denied: deniedAudits.length,
    },
    http,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ pass: false, error: error.message }, null, 2));
  process.exit(1);
});
