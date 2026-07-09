const fs = require('fs');
const path = require('path');

class MemoryEngine {
  constructor({ dataDir }) {
    this.contextFile = path.join(dataDir, 'context-store.json');
    this.context = this.load();
  }

  load() {
    if (!fs.existsSync(this.contextFile)) {
      return { executions: [], libraryAccesses: [] };
    }

    const context = JSON.parse(fs.readFileSync(this.contextFile, 'utf8'));
    return {
      ...context,
      executions: context.executions || [],
      libraryAccesses: context.libraryAccesses || [],
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

  persistLibraryAccess(access) {
    this.context.libraryAccesses.push(access);
    fs.mkdirSync(path.dirname(this.contextFile), { recursive: true });
    fs.writeFileSync(this.contextFile, JSON.stringify(this.context, null, 2), 'utf8');
    return access;
  }

  latestLibraryAccess() {
    return this.context.libraryAccesses[this.context.libraryAccesses.length - 1] || null;
  }
}

module.exports = { MemoryEngine };
