class InboundObservationStore {
  append(_record) {
    throw new Error('append must be implemented by subclasses');
  }
}

module.exports = { InboundObservationStore };
