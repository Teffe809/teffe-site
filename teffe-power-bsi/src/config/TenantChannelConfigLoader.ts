const { createTenantChannelConfig } = require('./TenantChannelConfig.ts');
const { TenantChannelConfigValidator } = require('./TenantChannelConfigValidator.ts');

class TenantChannelConfigLoader {
  constructor({ configs = [], validator = new TenantChannelConfigValidator() } = {}) {
    this.validator = validator;
    this.configs = configs.map((config) => this.add(config));
  }

  add(input) {
    const config = createTenantChannelConfig(input);
    const validation = this.validator.validate(config);
    if (!validation.valid) {
      const error = new Error('Tenant channel config is invalid');
      error.code = 'tenant_channel_config_invalid';
      error.details = validation;
      throw error;
    }

    return config;
  }

  list() {
    return this.configs.map((config) => ({ ...config }));
  }

  findByProvider(provider) {
    return this.configs.find((config) => config.provider === provider) ?? null;
  }

  findByPhoneNumberId(provider, phoneNumberId) {
    return this.configs.find((config) =>
      config.provider === provider &&
      config.phoneNumberId === phoneNumberId
    ) ?? null;
  }

  findEnabledByProvider(provider) {
    return this.configs.find((config) =>
      config.provider === provider &&
      config.enabled
    ) ?? null;
  }
}

module.exports = { TenantChannelConfigLoader };
