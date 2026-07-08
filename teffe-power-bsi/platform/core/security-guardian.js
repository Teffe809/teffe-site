class SecurityGuardian {
  validateVehicleIdentificationRequest(input) {
    const rawPlate = input?.plate == null ? '' : String(input.plate);
    const upperPlate = rawPlate.toUpperCase();

    if (!upperPlate.trim()) {
      return this.deny('plate_required', 'plate is required', null);
    }

    if (/[^A-Z0-9\s-]/.test(upperPlate)) {
      return this.deny('plate_invalid_characters', 'plate contains invalid characters', null);
    }

    const normalizedPlate = upperPlate.replace(/[\s-]/g, '');

    if (normalizedPlate.length < 7) {
      return this.deny('plate_too_short', 'plate must have 7 alphanumeric characters', normalizedPlate);
    }

    if (normalizedPlate.length > 7) {
      return this.deny('plate_too_long', 'plate must have 7 alphanumeric characters', normalizedPlate);
    }

    if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizedPlate)) {
      return this.deny('plate_invalid_format', 'plate must match Brazilian simple format', normalizedPlate);
    }

    return {
      allowed: true,
      normalizedInput: {
        ...input,
        plate: normalizedPlate,
      },
      normalizedPlate,
      sanitizedInput: {
        ...input,
        plate: normalizedPlate,
      },
    };
  }

  validateVehicleCompatibilityRequest(input) {
    const category = this.normalizeCategory(input?.category);
    const supportedCategories = ['freios', 'suspensao', 'motor', 'filtros'];

    if (!input?.vehicle) {
      return this.denyRequest('vehicle_required', 'identified vehicle is required');
    }

    if (!category) {
      return this.denyRequest('category_required', 'part category is required');
    }

    if (!supportedCategories.includes(category)) {
      return this.denyRequest(
        'category_not_supported',
        `part category must be one of: ${supportedCategories.join(', ')}`
      );
    }

    return {
      allowed: true,
      normalizedInput: {
        ...input,
        category,
      },
    };
  }

  normalizeCategory(category) {
    return String(category ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  denyRequest(code, message) {
    return {
      allowed: false,
      normalizedInput: null,
      error: { code, message },
    };
  }

  deny(code, message, normalizedPlate) {
    return {
      allowed: false,
      normalizedInput: normalizedPlate ? { normalizedPlate } : null,
      normalizedPlate,
      error: {
        code,
        message,
      },
    };
  }
}

module.exports = { SecurityGuardian };
