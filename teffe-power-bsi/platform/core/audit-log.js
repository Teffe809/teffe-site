const fs = require('fs');
const path = require('path');

class AuditLog {
  constructor({ dataDir }) {
    this.auditFile = path.join(dataDir, 'audit.jsonl');
  }

  record(event) {
    fs.mkdirSync(path.dirname(this.auditFile), { recursive: true });

    const entry = {
      id: `audit_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };

    fs.appendFileSync(this.auditFile, `${JSON.stringify(entry)}\n`, 'utf8');
    return entry;
  }
}

module.exports = { AuditLog };
