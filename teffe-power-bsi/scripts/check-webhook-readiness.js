const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { TenantChannelConfigLoader } = require('../src/config/TenantChannelConfigLoader.ts');
const { EnvSecretProvider } = require('../src/secrets/EnvSecretProvider.ts');
const { SanitizedLogger } = require('../src/runtime/logging/SanitizedLogger.ts');

function checkWebhookReadiness({
  env = process.env,
  cwd = process.cwd(),
  logger = null,
} = {}) {
  const checks = [];
  const envPath = path.join(cwd, '.env');
  const sendEnabled = String(env.TEFFE_WHATSAPP_SEND_ENABLED ?? '').toLowerCase() === 'true';
  const idempotencyFile = env.TEFFE_IDEMPOTENCY_STORE_FILE || path.join('data', 'idempotency-store.json');
  const verifyTokenRef = env.TEFFE_WHATSAPP_VERIFY_TOKEN_REF;
  const appSecretRef = env.TEFFE_WHATSAPP_APP_SECRET_REF;

  checks.push(check('env_exists_local', fs.existsSync(envPath), '.env must exist locally'));
  checks.push(check('env_not_versioned', !isTracked(cwd, '.env'), '.env must not be versioned'));
  checks.push(check('send_disabled', !sendEnabled, 'TEFFE_WHATSAPP_SEND_ENABLED must be false'));
  checks.push(check('verify_token_ref_present', Boolean(verifyTokenRef), 'verify token ref is required'));
  checks.push(check('app_secret_ref_present', Boolean(appSecretRef), 'app secret ref is required'));
  checks.push(check('webhook_port_present', Boolean(env.TEFFE_WEBHOOK_PORT), 'webhook port is required'));
  checks.push(check(
    'idempotency_file_not_versioned',
    !isTracked(cwd, idempotencyFile),
    'idempotency store file must not be versioned'
  ));

  let configOk = false;
  try {
    const configLoader = new TenantChannelConfigLoader({
      configs: [{
        tenantId: env.TEFFE_WEBHOOK_TENANT_ID || 'autopecas',
        channel: 'whatsapp',
        provider: 'whatsapp-cloud',
        phoneNumberId: env.TEFFE_WEBHOOK_PHONE_NUMBER_ID || 'mock-phone-number-id',
        businessAccountId: env.TEFFE_WEBHOOK_BUSINESS_ACCOUNT_ID || 'mock-business-account-id',
        verifyTokenRef,
        appSecretRef,
        accessTokenRef: env.TEFFE_WHATSAPP_ACCESS_TOKEN_REF || 'TEFFE_WHATSAPP_ACCESS_TOKEN',
        enabled: env.TEFFE_WEBHOOK_ENABLED !== 'false',
        mode: env.TEFFE_WEBHOOK_MODE || 'sandbox',
      }],
    });
    const secretProvider = new EnvSecretProvider({ env });
    configOk = Boolean(configLoader.findByProvider('whatsapp-cloud')) &&
      hasSecretValue(secretProvider.getSecret(verifyTokenRef)) &&
      hasSecretValue(secretProvider.getSecret(appSecretRef));
  } catch (_error) {
    configOk = false;
  }

  checks.push(check('runtime_config_starts', configOk, 'runtime config must start with local refs'));

  const ok = checks.every((item) => item.ok);
  const result = {
    ok,
    checks,
  };

  if (logger) {
    logger.info('webhook.readiness.checked', result);
  }

  return result;
}

function check(name, ok, message) {
  return {
    name,
    ok,
    message: ok ? null : message,
  };
}

function isTracked(cwd, filePath) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', filePath], {
      cwd,
      stdio: 'ignore',
    });
    return true;
  } catch (_error) {
    return false;
  }
}

function hasSecretValue(value) {
  return value != null && String(value).trim() !== '';
}

if (require.main === module) {
  const logger = new SanitizedLogger();
  const result = checkWebhookReadiness({ logger });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

module.exports = { checkWebhookReadiness };
