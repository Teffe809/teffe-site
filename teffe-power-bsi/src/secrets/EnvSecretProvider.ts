const { SecretProvider } = require('./SecretProvider.ts');

class EnvSecretProvider extends SecretProvider {
  constructor({ env = process.env, prefix = '' } = {}) {
    super();
    this.env = env;
    this.prefix = prefix;
  }

  getSecret(ref) {
    if (!ref || typeof ref !== 'string') {
      return null;
    }

    return this.env[`${this.prefix}${ref}`] ?? null;
  }
}

module.exports = { EnvSecretProvider };
