class MiaCore {
  constructor({ workflowEngine }) {
    this.workflowEngine = workflowEngine;
  }

  handleManualVehicleIdentification({ plate, userId = 'capability-validation' }) {
    return this.workflowEngine.runVehicleIdentification(
      { plate },
      {
        source: 'mia-core',
        userId,
        intent: 'vehicle.identify.manual',
        ai: false,
      }
    );
  }

  handleVehicleCompatibility({ vehicle, category, userId = 'capability-validation' }) {
    return this.workflowEngine.runVehicleCompatibility(
      { vehicle, category },
      {
        source: 'mia-core',
        userId,
        intent: 'vehicle.compatibility',
        ai: false,
      }
    );
  }

  handleStockAvailability({ vehicle, part, userId = 'capability-validation' }) {
    return this.workflowEngine.runStockAvailability(
      { vehicle, part },
      {
        source: 'mia-core',
        userId,
        intent: 'stock.availability',
        ai: false,
      }
    );
  }

  handleServiceIntelligence({ vehicle, part, category, userId = 'capability-validation' }) {
    return this.workflowEngine.runServiceIntelligence(
      { vehicle, part, category },
      {
        source: 'mia-core',
        userId,
        intent: 'service.intelligence',
        ai: false,
      }
    );
  }

  handleRecommendation({
    vehicle,
    part,
    category,
    serviceIntelligence,
    userId = 'capability-validation',
  }) {
    return this.workflowEngine.runRecommendation(
      { vehicle, part, category, serviceIntelligence },
      {
        source: 'mia-core',
        userId,
        intent: 'recommendation.engine',
        ai: false,
      }
    );
  }

  handleBudgetIntelligence({
    vehicle,
    part,
    category,
    serviceIntelligence,
    recommendation,
    userId = 'capability-validation',
  }) {
    return this.workflowEngine.runBudgetIntelligence(
      { vehicle, part, category, serviceIntelligence, recommendation },
      {
        source: 'mia-core',
        userId,
        intent: 'budget.intelligence',
        ai: false,
      }
    );
  }

  handlePricingIntelligence({ budget, userId = 'capability-validation' }) {
    return this.workflowEngine.runPricingIntelligence(
      { budget },
      {
        source: 'mia-core',
        userId,
        intent: 'pricing.intelligence',
        ai: false,
      }
    );
  }

  handleDecisionIntelligence({ pricing, userId = 'capability-validation' }) {
    return this.workflowEngine.runDecisionIntelligence(
      { pricing },
      {
        source: 'mia-core',
        userId,
        intent: 'decision.intelligence',
        ai: false,
      }
    );
  }
}

module.exports = { MiaCore };
