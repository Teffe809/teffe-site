const LIBRARY_TYPES = ['knowledge', 'decision', 'business', 'commercial'];
const LIBRARY_STATUSES = ['draft', 'active', 'deprecated', 'archived'];
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

class LibraryRegistry {
  constructor() {
    this.libraries = new Map();
  }

  register(library) {
    this.validate(library);
    const key = this.key(library.id, library.version);

    if (this.libraries.has(key)) {
      throw new Error(`Library already registered: ${key}`);
    }

    for (const dependency of library.dependencies) {
      if (!this.has(dependency.id, dependency.version)) {
        throw new Error(
          `Library dependency not registered: ${this.key(dependency.id, dependency.version)}`
        );
      }
    }

    const registered = this.copy(library);
    this.libraries.set(key, registered);
    return this.copy(registered);
  }

  get(id, version = null) {
    if (version) {
      const library = this.libraries.get(this.key(id, version));
      return library ? this.copy(library) : null;
    }

    const versions = this.versions(id);
    return versions.length > 0 ? this.get(id, versions[versions.length - 1]) : null;
  }

  has(id, version) {
    return this.libraries.has(this.key(id, version));
  }

  list(filters = {}) {
    return Array.from(this.libraries.values())
      .filter((library) => Object.entries(filters).every(([field, value]) => {
        if (field === 'consumingCapability') {
          return library.consumingCapabilities.includes(value);
        }
        return library[field] === value;
      }))
      .map((library) => this.copy(library));
  }

  versions(id) {
    return Array.from(this.libraries.values())
      .filter((library) => library.id === id)
      .map((library) => library.version)
      .sort(this.compareVersions);
  }

  key(id, version) {
    return `${id}@${version}`;
  }

  compareVersions(left, right) {
    const leftParts = left.split('.').map(Number);
    const rightParts = right.split('.').map(Number);

    for (let index = 0; index < 3; index += 1) {
      if (leftParts[index] !== rightParts[index]) {
        return leftParts[index] - rightParts[index];
      }
    }
    return 0;
  }

  validate(library) {
    const requiredFields = [
      'type',
      'id',
      'name',
      'version',
      'segment',
      'description',
      'author',
      'publishedAt',
      'dependencies',
      'consumingCapabilities',
      'status',
    ];

    for (const field of requiredFields) {
      if (library?.[field] == null || library[field] === '') {
        throw new Error(`Library metadata missing required field: ${field}`);
      }
    }

    if (!LIBRARY_TYPES.includes(library.type)) {
      throw new Error(`Invalid library type: ${library.type}`);
    }
    if (!SEMVER_PATTERN.test(library.version)) {
      throw new Error(`Invalid library version: ${library.version}`);
    }
    if (!LIBRARY_STATUSES.includes(library.status)) {
      throw new Error(`Invalid library status: ${library.status}`);
    }
    if (Number.isNaN(Date.parse(library.publishedAt))) {
      throw new Error(`Invalid library publication date: ${library.publishedAt}`);
    }
    if (!Array.isArray(library.dependencies) || !Array.isArray(library.consumingCapabilities)) {
      throw new Error('Library dependencies and consumingCapabilities must be arrays');
    }

    for (const dependency of library.dependencies) {
      if (!dependency?.id || !SEMVER_PATTERN.test(dependency?.version || '')) {
        throw new Error('Library dependency must contain id and semantic version');
      }
    }
  }

  copy(library) {
    return {
      ...library,
      dependencies: library.dependencies.map((dependency) => ({ ...dependency })),
      consumingCapabilities: [...library.consumingCapabilities],
    };
  }
}

module.exports = {
  LIBRARY_STATUSES,
  LIBRARY_TYPES,
  LibraryRegistry,
  SEMVER_PATTERN,
};
