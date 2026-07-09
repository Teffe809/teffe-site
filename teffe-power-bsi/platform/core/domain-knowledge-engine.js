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

  getServiceIntelligence({ category, component }) {
    const system = this.getSystemByName(category) || this.getSystemsByComponent(component)[0] || null;
    if (!system) {
      return null;
    }

    return {
      system: {
        id: system.id,
        name: system.name,
        description: system.description,
      },
      relatedComponents: [...system.relatedComponents],
      recommendations: [...system.technicalNotes],
      priority: system.servicePriority,
      technicalJustification:
        `${component} requer avaliacao do sistema ${system.name}: ${system.description}`,
    };
  }

  getRecommendations({ category, component, serviceIntelligence }) {
    const categorySystem = this.getSystemByName(category);
    const intelligenceSystem = this.getSystemByName(serviceIntelligence?.system?.id);
    if (!categorySystem || !intelligenceSystem || categorySystem.id !== intelligenceSystem.id) {
      return null;
    }

    const complementaryComponents = (serviceIntelligence.relatedComponents || [])
      .filter((candidate) => !this.componentsMatch(candidate, component));
    const suggestedKits = complementaryComponents.length === 0
      ? []
      : [{
          name: `Kit preventivo ${categorySystem.name}`,
          components: complementaryComponents.slice(0, 3),
        }];

    return {
      complementaryComponents,
      suggestedKits,
      preventiveRecommendations: [...categorySystem.technicalNotes],
      technicalJustification:
        `${serviceIntelligence.technicalJustification} Recomendacao baseada no sistema ${categorySystem.name}.`,
      priority: categorySystem.servicePriority,
      confidence: complementaryComponents.length >= 3
        ? 'high'
        : complementaryComponents.length > 0
          ? 'medium'
          : 'low',
    };
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

  componentsMatch(left, right) {
    const normalizedLeft = this.normalize(left);
    const normalizedRight = this.normalize(right);
    return normalizedLeft === normalizedRight ||
      normalizedLeft.includes(normalizedRight) ||
      normalizedRight.includes(normalizedLeft);
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
