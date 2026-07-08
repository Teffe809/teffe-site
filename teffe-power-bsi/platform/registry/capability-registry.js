class CapabilityRegistry {
  constructor() {
    this.capabilities = new Map();
  }

  register(capability) {
    this.validate(capability);
    this.capabilities.set(capability.id, { ...capability });
    return this.get(capability.id);
  }

  get(id) {
    return this.capabilities.get(id) || null;
  }

  list() {
    return Array.from(this.capabilities.values());
  }

  has(id) {
    return this.capabilities.has(id);
  }

  validate(capability) {
    const requiredFields = ['id', 'name', 'version', 'description', 'inputContract', 'outputContract'];

    for (const field of requiredFields) {
      if (!capability?.[field]) {
        throw new Error(`Capability metadata missing required field: ${field}`);
      }
    }
  }
}

module.exports = { CapabilityRegistry };
