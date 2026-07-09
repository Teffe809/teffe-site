const fs = require('fs');
const path = require('path');
const { MemoryRetention, estimateBytes } = require('./memory-retention');

class MemoryEngine {
  constructor({ dataDir, retention = {} }) {
    this.contextFile = path.join(dataDir, 'context-store.json');
    this.retention = new MemoryRetention(retention);
    this.context = this.load();
  }

  load() {
    if (!fs.existsSync(this.contextFile)) {
      return {
        executions: [],
        libraryAccesses: [],
        workflows: [],
        tenantAccesses: [],
        communications: [],
        dispatches: [],
        understandings: [],
      };
    }

    const context = JSON.parse(fs.readFileSync(this.contextFile, 'utf8'));
    return {
      ...context,
      executions: context.executions || [],
      libraryAccesses: context.libraryAccesses || [],
      workflows: context.workflows || [],
      tenantAccesses: context.tenantAccesses || [],
      communications: context.communications || [],
      dispatches: context.dispatches || [],
      understandings: context.understandings || [],
    };
  }

  persistExecution(execution) {
    return this.persistRecord('executions', execution);
  }

  latestExecution() {
    return this.context.executions[this.context.executions.length - 1] || null;
  }

  latestExecutionReference() {
    const latest = this.latestExecution();

    if (!latest) {
      return null;
    }

    return {
      id: latest.id,
      capability: latest.capability,
      auditId: latest.auditId,
      timestamp: latest.timestamp,
    };
  }

  persistLibraryAccess(access) {
    return this.persistRecord('libraryAccesses', access);
  }

  latestLibraryAccess() {
    return this.context.libraryAccesses[this.context.libraryAccesses.length - 1] || null;
  }

  persistWorkflow(workflow) {
    return this.persistRecord('workflows', workflow);
  }

  latestWorkflow() {
    return this.context.workflows[this.context.workflows.length - 1] || null;
  }

  persistTenantAccess(access) {
    return this.persistRecord('tenantAccesses', access);
  }

  latestTenantAccess() {
    return this.context.tenantAccesses[this.context.tenantAccesses.length - 1] || null;
  }

  persistCommunication(message) {
    return this.persistRecord('communications', message);
  }

  latestCommunication() {
    return this.context.communications[this.context.communications.length - 1] || null;
  }

  persistDispatch(dispatch) {
    return this.persistRecord('dispatches', dispatch);
  }

  latestDispatch() {
    return this.context.dispatches[this.context.dispatches.length - 1] || null;
  }

  persistUnderstanding(understanding) {
    return this.persistRecord('understandings', understanding);
  }

  latestUnderstanding() {
    return this.context.understandings[this.context.understandings.length - 1] || null;
  }

  persistRecord(collection, record) {
    const compactedRecord = this.retention.compactRecord(collection, record);
    this.context[collection].push(compactedRecord);
    this.compactNow({ persist: false });
    this.write();
    return compactedRecord;
  }

  compactNow({ persist = true } = {}) {
    const { context, stats } = this.retention.compactContext(this.context);
    this.context = context;

    if (persist) {
      this.write();
    }

    return {
      ...stats,
      file: this.contextFile,
      currentBytes: this.sizeBytes(),
    };
  }

  sizeBytes() {
    if (fs.existsSync(this.contextFile)) {
      return fs.statSync(this.contextFile).size;
    }

    return estimateBytes(this.context);
  }

  write() {
    fs.mkdirSync(path.dirname(this.contextFile), { recursive: true });
    fs.writeFileSync(this.contextFile, JSON.stringify(this.context, null, 2), 'utf8');
  }
}

module.exports = { MemoryEngine };
