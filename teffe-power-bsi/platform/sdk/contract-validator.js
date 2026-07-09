const { CapabilityError } = require('./capability-error');

const REQUEST_CONTRACT = {
  type: 'object',
  required: ['capability', 'pluginId', 'input', 'executionContext', 'requestedAt'],
  properties: {
    capability: { type: 'string', minLength: 1 },
    pluginId: { type: 'string', minLength: 1 },
    input: { type: 'object' },
    context: { type: 'object' },
    executionContext: { type: 'object' },
    metadata: { type: 'object' },
    requestedAt: { type: 'string', minLength: 1 },
  },
};

const RESPONSE_CONTRACT = {
  type: 'object',
  required: ['ok', 'normalizedInput', 'auditId', 'audit'],
  properties: {
    ok: { type: 'boolean' },
    normalizedInput: { type: ['object', 'null'] },
    auditId: { type: 'string', minLength: 1 },
    audit: { type: 'object' },
  },
};

class ContractValidator {
  validateRequest(request, inputContract) {
    const envelope = this.validate(request, REQUEST_CONTRACT);
    if (!envelope.valid) {
      return this.failure('capability_request_contract_invalid', 'CapabilityRequest contract is invalid', envelope.errors);
    }

    const input = this.validate(request.input, inputContract);
    if (!input.valid) {
      return this.failure('capability_input_contract_invalid', 'Capability input contract is invalid', input.errors);
    }

    return { valid: true, errors: [] };
  }

  validateResult(result, resultContract) {
    const validation = this.validate(result, resultContract);
    if (!validation.valid) {
      return this.failure('capability_result_contract_invalid', 'Capability result contract is invalid', validation.errors);
    }

    return { valid: true, errors: [] };
  }

  validateResponse(response) {
    const envelope = this.validate(response, RESPONSE_CONTRACT);
    const errors = [...envelope.errors];

    if (response?.ok === true && (!response.result || !response.execution)) {
      errors.push({ path: '$', rule: 'successShape', message: 'Success response requires result and execution' });
    }

    if (response?.ok === false && !this.isError(response.error)) {
      errors.push({ path: '$.error', rule: 'errorShape', message: 'Failure response requires a CapabilityError' });
    }

    if (errors.length > 0) {
      return this.failure('capability_response_contract_invalid', 'CapabilityResponse contract is invalid', errors);
    }

    return { valid: true, errors: [] };
  }

  validate(value, contract) {
    if (!contract) {
      return { valid: true, errors: [] };
    }

    const errors = [];
    this.validateNode(value, contract, '$', errors);
    return { valid: errors.length === 0, errors };
  }

  validateNode(value, contract, path, errors) {
    if (!contract || typeof contract !== 'object') {
      return;
    }

    const types = Array.isArray(contract.type) ? contract.type : [contract.type].filter(Boolean);
    if (types.length > 0 && !types.some((type) => this.matchesType(value, type))) {
      errors.push({ path, rule: 'type', message: `Expected ${types.join(' or ')}` });
      return;
    }

    if (contract.enum && !contract.enum.includes(value)) {
      errors.push({
        path,
        rule: 'enum',
        message: `Expected one of: ${contract.enum.join(', ')}`,
      });
    }

    if (typeof value === 'string') {
      if (contract.minLength != null && value.length < contract.minLength) {
        errors.push({ path, rule: 'minLength', message: `Minimum length is ${contract.minLength}` });
      }
      if (contract.maxLength != null && value.length > contract.maxLength) {
        errors.push({ path, rule: 'maxLength', message: `Maximum length is ${contract.maxLength}` });
      }
      if (contract.pattern && !(new RegExp(contract.pattern).test(value))) {
        errors.push({ path, rule: 'pattern', message: 'Value does not match the required pattern' });
      }
    }

    if (typeof value === 'number' && contract.minimum != null && value < contract.minimum) {
      errors.push({ path, rule: 'minimum', message: `Minimum value is ${contract.minimum}` });
    }

    if (Array.isArray(value)) {
      if (contract.minItems != null && value.length < contract.minItems) {
        errors.push({ path, rule: 'minItems', message: `Minimum item count is ${contract.minItems}` });
      }

      if (contract.items) {
        value.forEach((item, index) => this.validateNode(item, contract.items, `${path}[${index}]`, errors));
      }
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const key of contract.required || []) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          errors.push({ path: `${path}.${key}`, rule: 'required', message: 'Required property is missing' });
        }
      }

      for (const [key, propertyContract] of Object.entries(contract.properties || {})) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          this.validateNode(value[key], propertyContract, `${path}.${key}`, errors);
        }
      }
    }
  }

  matchesType(value, type) {
    if (type === 'null') return value === null;
    if (type === 'array') return Array.isArray(value);
    if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
    if (type === 'integer') return Number.isInteger(value);
    return typeof value === type;
  }

  isError(error) {
    return error instanceof CapabilityError ||
      Boolean(error && typeof error.code === 'string' && typeof error.message === 'string');
  }

  failure(code, message, errors) {
    return {
      valid: false,
      errors,
      error: new CapabilityError(code, message, { violations: errors }),
    };
  }
}

module.exports = { ContractValidator };
