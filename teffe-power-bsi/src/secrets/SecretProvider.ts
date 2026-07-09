class SecretProvider {
  getSecret() {
    throw new Error('getSecret must be implemented by secret provider');
  }

  requireSecret(ref) {
    const value = this.getSecret(ref);
    if (!value) {
      const error = new Error(`Secret is not available for ref: ${ref}`);
      error.code = 'secret_missing';
      throw error;
    }

    return value;
  }
}

module.exports = { SecretProvider };
