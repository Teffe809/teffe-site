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
}

module.exports = { MiaCore };
