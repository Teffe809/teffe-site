class LibraryDiscovery {
  constructor({ registry }) {
    this.registry = registry;
  }

  findById(id, version = null) {
    return this.registry.get(id, version);
  }

  findByMetadata(filters = {}) {
    return this.registry.list(filters);
  }

  findByConsumer(capabilityId) {
    return this.registry.list({ consumingCapability: capabilityId });
  }

  findDependents(id, version) {
    return this.registry.list().filter((library) =>
      library.dependencies.some((dependency) =>
        dependency.id === id && dependency.version === version
      )
    );
  }

  resolveDependencies(id, version = null) {
    const library = this.registry.get(id, version);
    if (!library) {
      return [];
    }

    return library.dependencies.map((dependency) =>
      this.registry.get(dependency.id, dependency.version)
    );
  }
}

module.exports = { LibraryDiscovery };
