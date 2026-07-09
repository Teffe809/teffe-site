const { SecretProvider } = require('./SecretProvider.ts');

class MockSecretProvider extends SecretProvider {
  constructor(secrets = {}) {
    super();
    this.secrets = { ...secrets };
  }

  getSecret(ref) {
    return this.secrets[ref] ?? null;
  }
}

module.exports = { MockSecretProvider };
