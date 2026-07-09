const { LogSanitizer } = require('./LogSanitizer.ts');

class SanitizedLogger {
  constructor({ sink = console, sanitizer = new LogSanitizer() } = {}) {
    this.sink = sink;
    this.sanitizer = sanitizer;
  }

  info(message, metadata = {}) {
    this.write('info', message, metadata);
  }

  warn(message, metadata = {}) {
    this.write('warn', message, metadata);
  }

  error(message, metadata = {}) {
    this.write('error', message, metadata);
  }

  write(level, message, metadata) {
    const entry = {
      level,
      message,
      metadata: this.sanitizer.sanitize(metadata),
      timestamp: new Date().toISOString(),
    };

    const writer = this.sink[level] || this.sink.log || console.log;
    writer.call(this.sink, JSON.stringify(entry));
  }
}

module.exports = { SanitizedLogger };
