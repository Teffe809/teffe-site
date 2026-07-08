class CapabilityError {
  constructor(code, message, details = null) {
    this.code = code;
    this.message = message;

    if (details != null) {
      this.details = details;
    }
  }

  static from(error) {
    if (error instanceof CapabilityError) {
      return error;
    }

    if (error?.code && error?.message) {
      return new CapabilityError(error.code, error.message, error.details ?? null);
    }

    return new CapabilityError('capability_error', 'Capability execution failed');
  }
}

module.exports = { CapabilityError };
