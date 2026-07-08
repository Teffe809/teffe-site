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
}

module.exports = { MiaCore };
