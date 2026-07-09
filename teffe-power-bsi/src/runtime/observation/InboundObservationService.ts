const { createInboundObservationRecord } = require('./InboundObservationRecord.ts');

class InboundObservationService {
  constructor({ store } = {}) {
    this.store = store ?? null;
  }

  record(input = {}) {
    const record = createInboundObservationRecord(input);
    if (!this.store) {
      return record;
    }

    return this.store.append(record);
  }
}

module.exports = { InboundObservationService };
