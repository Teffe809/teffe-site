const fs = require('fs');
const path = require('path');
const { InboundObservationStore } = require('./InboundObservationStore.ts');
const { LogSanitizer } = require('../logging/LogSanitizer.ts');

class FileInboundObservationStore extends InboundObservationStore {
  constructor({ filePath } = {}) {
    super();
    if (!filePath) throw new Error('filePath is required');
    this.filePath = filePath;
    this.sanitizer = new LogSanitizer();
  }

  append(record) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const sanitized = this.sanitizer.sanitize(record);
    fs.appendFileSync(this.filePath, `${JSON.stringify(sanitized)}\n`, 'utf8');
    return sanitized;
  }
}

module.exports = { FileInboundObservationStore };
