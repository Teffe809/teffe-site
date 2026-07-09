const http = require('http');
const os = require('os');
const path = require('path');
const { bootPlatform } = require('../platform');
const { TenantChannelConfigLoader } = require('../src/config/TenantChannelConfigLoader.ts');
const { EnvSecretProvider } = require('../src/secrets/EnvSecretProvider.ts');
const { WebhookRuntime } = require('../src/runtime/webhook/WebhookRuntime.ts');

const PORT = Number(process.env.TEFFE_WEBHOOK_PORT || process.env.WEBHOOK_RUNTIME_PORT || 3100);
const dataDir = process.env.TEFFE_DATA_DIR || path.join(os.tmpdir(), 'teffe-webhook-runtime');
const platform = bootPlatform({ dataDir });
const configLoader = new TenantChannelConfigLoader({
  configs: [{
    tenantId: process.env.TEFFE_WEBHOOK_TENANT_ID || 'autopecas',
    channel: 'whatsapp',
    provider: 'whatsapp-cloud',
    phoneNumberId: process.env.TEFFE_WEBHOOK_PHONE_NUMBER_ID || 'mock-phone-number-id',
    businessAccountId: process.env.TEFFE_WEBHOOK_BUSINESS_ACCOUNT_ID || 'mock-business-account-id',
    verifyTokenRef: process.env.TEFFE_WHATSAPP_VERIFY_TOKEN_REF || 'TEFFE_WHATSAPP_VERIFY_TOKEN',
    appSecretRef: process.env.TEFFE_WHATSAPP_APP_SECRET_REF || 'TEFFE_WHATSAPP_APP_SECRET',
    accessTokenRef: process.env.TEFFE_WHATSAPP_ACCESS_TOKEN_REF || 'TEFFE_WHATSAPP_ACCESS_TOKEN',
    enabled: process.env.TEFFE_WEBHOOK_ENABLED !== 'false',
    mode: process.env.TEFFE_WEBHOOK_MODE || 'mock',
  }],
});
const runtime = new WebhookRuntime({
  configLoader,
  secretProvider: new EnvSecretProvider(),
  platform,
  runtimeConfig: {
    whatsappSendEnabled: process.env.TEFFE_WHATSAPP_SEND_ENABLED === 'true',
  },
});

const server = http.createServer((req, res) => {
  if (!['/webhook/whatsapp-cloud'].includes(req.url.split('?')[0])) {
    return send(res, { statusCode: 404, body: { ok: false, error: { code: 'not_found' } } });
  }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  collectBody(req, (rawBody) => {
    const response = runtime.handle({
      method: req.method,
      provider: 'whatsapp-cloud',
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: req.headers,
      rawBody,
    });
    send(res, response);
  });
});

server.listen(PORT, () => {
  console.log(`TEFFE webhook runtime listening on ${PORT}`);
  console.log('  GET  /webhook/whatsapp-cloud');
  console.log('  POST /webhook/whatsapp-cloud');
});

function collectBody(req, done) {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => done(Buffer.concat(chunks).toString('utf8')));
}

function send(res, response) {
  res.writeHead(response.statusCode, response.headers || { 'content-type': 'application/json' });
  if (typeof response.body === 'string') {
    res.end(response.body);
  } else {
    res.end(JSON.stringify(response.body));
  }
}
