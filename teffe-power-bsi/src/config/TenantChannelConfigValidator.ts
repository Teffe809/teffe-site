const VALID_MODES = ['mock', 'sandbox', 'production'];

class TenantChannelConfigValidator {
  validate(config) {
    const violations = [];

    required(config.tenantId, 'tenantId', violations);
    required(config.channel, 'channel', violations);
    required(config.provider, 'provider', violations);
    required(config.verifyTokenRef, 'verifyTokenRef', violations);
    required(config.accessTokenRef, 'accessTokenRef', violations);

    if (config.mode && !VALID_MODES.includes(config.mode)) {
      violations.push({
        path: '$.mode',
        rule: 'enum',
        message: `mode must be one of: ${VALID_MODES.join(', ')}`,
      });
    }

    if (config.tenantId && !/^[a-z0-9_-]+$/.test(config.tenantId)) {
      violations.push({
        path: '$.tenantId',
        rule: 'format',
        message: 'tenantId format is invalid',
      });
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }
}

function required(value, path, violations) {
  if (value == null || String(value).trim() === '') {
    violations.push({
      path: `$.${path}`,
      rule: 'required',
      message: `${path} is required`,
    });
  }
}

module.exports = { TenantChannelConfigValidator, VALID_MODES };
