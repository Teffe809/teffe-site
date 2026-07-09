const fs = require('fs');
const path = require('path');

class MemoryEngine {
  constructor({ dataDir }) {
    this.contextFile = path.join(dataDir, 'context-store.json');
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
    this.context.executions.push(execution);
    fs.mkdirSync(path.dirname(this.contextFile), { recursive: true });
    fs.writeFileSync(this.contextFile, JSON.stringify(this.context, null, 2), 'utf8');
    return execution;
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
    this.context.libraryAccesses.push(access);
    fs.mkdirSync(path.dirname(this.contextFile), { recursive: true });
    fs.writeFileSync(this.contextFile, JSON.stringify(this.context, null, 2), 'utf8');
    return access;
  }

  latestLibraryAccess() {
    return this.context.libraryAccesses[this.context.libraryAccesses.length - 1] || null;
  }

  persistWorkflow(workflow) {
    this.context.workflows.push(workflow);
    fs.mkdirSync(path.dirname(this.contextFile), { recursive: true });
    fs.writeFileSync(this.contextFile, JSON.stringify(this.context, null, 2), 'utf8');
    return workflow;
  }

  latestWorkflow() {
    return this.context.workflows[this.context.workflows.length - 1] || null;
  }

  persistTenantAccess(access) {
    this.context.tenantAccesses.push(access);
    fs.mkdirSync(path.dirname(this.contextFile), { recursive: true });
    fs.writeFileSync(this.contextFile, JSON.stringify(this.context, null, 2), 'utf8');
    return access;
  }

  latestTenantAccess() {
    return this.context.tenantAccesses[this.context.tenantAccesses.length - 1] || null;
  }

  persistCommunication(message) {
    this.context.communications.push(message);
    fs.mkdirSync(path.dirname(this.contextFile), { recursive: true });
    fs.writeFileSync(this.contextFile, JSON.stringify(this.context, null, 2), 'utf8');
    return message;
  }

  latestCommunication() {
    return this.context.communications[this.context.communications.length - 1] || null;
  }

  persistDispatch(dispatch) {
    this.context.dispatches.push(dispatch);
    fs.mkdirSync(path.dirname(this.contextFile), { recursive: true });
    fs.writeFileSync(this.contextFile, JSON.stringify(this.context, null, 2), 'utf8');
    return dispatch;
  }

  latestDispatch() {
    return this.context.dispatches[this.context.dispatches.length - 1] || null;
  }

  persistUnderstanding(understanding) {
    this.context.understandings.push(understanding);
    fs.mkdirSync(path.dirname(this.contextFile), { recursive: true });
    fs.writeFileSync(this.contextFile, JSON.stringify(this.context, null, 2), 'utf8');
    return understanding;
  }

  latestUnderstanding() {
    return this.context.understandings[this.context.understandings.length - 1] || null;
  }
}

module.exports = { MemoryEngine };
