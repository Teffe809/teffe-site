class CapabilityDiscovery {
  constructor({ registry }) {
    this.registry = registry;
  }

  findById(id) {
    return this.registry.get(id);
  }

  findByMetadata(criteria = {}) {
    return this.registry.list().filter((capability) => this.matches(capability, criteria));
  }

  matches(capability, criteria) {
    return Object.entries(criteria).every(([key, expected]) => {
      const actual = capability[key];

      if (Array.isArray(expected)) {
        return expected.includes(actual);
      }

      if (expected instanceof RegExp) {
        return expected.test(String(actual || ''));
      }

      return actual === expected;
    });
  }
}

module.exports = { CapabilityDiscovery };
