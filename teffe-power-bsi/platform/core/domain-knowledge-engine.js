const { AUTOPARTS_SYSTEMS } = require('../domain/autoparts-knowledge');

class DomainKnowledgeEngine {
  constructor({ systems = AUTOPARTS_SYSTEMS } = {}) {
    this.systems = systems.map((system) => this.copySystem(system));
    this.systemsById = new Map(this.systems.map((system) => [system.id, system]));
  }

  getSystemByName(name) {
    const system = this.systemsById.get(this.normalize(name));
    return system ? this.copySystem(system) : null;
  }

  getComponents(systemName) {
    const system = this.getSystemByName(systemName);
    return system ? [...system.relatedComponents] : [];
  }

  getSystemsByComponent(component) {
    const normalizedComponent = this.normalize(component);

    return this.systems
      .filter((system) => system.relatedComponents.some(
        (candidate) => this.normalize(candidate) === normalizedComponent
      ))
      .map((system) => this.copySystem(system));
  }

  componentBelongsToSystem(component, systemName) {
    const normalizedComponent = this.normalize(component);
    return this.getComponents(systemName).some(
      (candidate) => this.normalize(candidate) === normalizedComponent
    );
  }

  listSystems() {
    return this.systems.map((system) => this.copySystem(system));
  }

  normalize(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  copySystem(system) {
    return {
      ...system,
      categories: [...system.categories],
      relatedComponents: [...system.relatedComponents],
      technicalNotes: [...system.technicalNotes],
    };
  }
}

module.exports = { DomainKnowledgeEngine };
