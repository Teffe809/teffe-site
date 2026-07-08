const MOCK_VEHICLES = {
  ABC1D23: {
    plate: 'ABC1D23',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    color: 'Prata',
    ownerType: 'Pessoa Juridica',
    status: 'mock_active',
  },
  TFF2026: {
    plate: 'TFF2026',
    brand: 'Volkswagen',
    model: 'Delivery Express',
    year: 2026,
    color: 'Branco',
    ownerType: 'Frota Teffe',
    status: 'mock_active',
  },
};

module.exports = {
  id: 'vehicle-identification-manual',
  name: 'Vehicle Identification Manual',
  version: '0.1.0',
  capability: {
    id: 'vehicle-identification.manual',
    name: 'Vehicle Identification Manual',
    version: '0.1.0',
    description: 'Identifies a vehicle from a manually provided Brazilian plate using local mock data.',
    inputContract: {
      type: 'object',
      required: ['plate'],
      properties: {
        plate: {
          type: 'string',
          description: 'Brazilian vehicle plate with optional hyphen or spaces.',
        },
      },
    },
    resultContract: {
      type: 'object',
      required: ['source', 'vehicle'],
      properties: {
        source: { type: 'string', minLength: 1 },
        vehicle: {
          type: 'object',
          required: ['plate', 'brand', 'model', 'year', 'color', 'ownerType', 'status'],
          properties: {
            plate: { type: 'string', minLength: 7, maxLength: 7 },
            brand: { type: 'string', minLength: 1 },
            model: { type: 'string', minLength: 1 },
            year: { type: 'integer' },
            color: { type: 'string', minLength: 1 },
            ownerType: { type: 'string', minLength: 1 },
            status: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    outputContract: {
      success: {
        ok: true,
        normalizedPlate: 'string',
        vehicle: 'object',
        auditId: 'string',
      },
      failure: {
        ok: false,
        normalizedPlate: 'string|null',
        error: {
          code: 'string',
          message: 'string',
        },
        auditId: 'string',
      },
    },
  },
  execute(input, _executionContext = {}) {
    const fallback = {
      plate: input.plate,
      brand: 'Fiat',
      model: 'Strada',
      year: 2021,
      color: 'Branco',
      ownerType: 'Pessoa Juridica',
      status: 'mock_active',
    };

    return {
      source: 'mock',
      vehicle: MOCK_VEHICLES[input.plate] || fallback,
    };
  },
};
