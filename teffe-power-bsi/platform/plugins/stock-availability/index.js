const STOCK_BY_INTERNAL_CODE = {
  'TFF-FRE-001': {
    available: true,
    quantity: 12,
    branch: 'Filial Centro',
    estimatedDelivery: 'Pronta entrega',
    notes: 'Estoque mockado no balcao e reservado por ordem de confirmacao.',
  },
  'TFF-FRE-002': {
    available: false,
    quantity: 0,
    branch: 'Centro de Distribuicao',
    estimatedDelivery: '5 dias uteis',
    notes: 'Estoque mockado em reposicao.',
  },
  'TFF-SUS-001': {
    available: true,
    quantity: 4,
    branch: 'Filial Norte',
    estimatedDelivery: '1 dia util',
    notes: 'Estoque mockado; quantidade corresponde a unidades.',
  },
  'TFF-MOT-001': {
    available: false,
    quantity: 0,
    branch: 'Centro de Distribuicao',
    estimatedDelivery: '7 dias uteis',
    notes: 'Estoque mockado aguardando recebimento do fabricante.',
  },
  'TFF-FIL-001': {
    available: true,
    quantity: 28,
    branch: 'Filial Centro',
    estimatedDelivery: 'Pronta entrega',
    notes: 'Estoque mockado disponivel para retirada.',
  },
  'TFF-FIL-002': {
    available: true,
    quantity: 16,
    branch: 'Filial Sul',
    estimatedDelivery: '2 dias uteis',
    notes: 'Estoque mockado com transferencia entre filiais.',
  },
};

const vehicleContract = {
  type: 'object',
  required: ['plate', 'brand', 'model', 'year'],
  properties: {
    plate: { type: 'string', minLength: 7, maxLength: 7 },
    brand: { type: 'string', minLength: 1 },
    model: { type: 'string', minLength: 1 },
    year: { type: 'integer' },
  },
};

const partContract = {
  type: 'object',
  required: ['name', 'manufacturer', 'internalCode', 'technicalNotes'],
  properties: {
    name: { type: 'string', minLength: 1 },
    manufacturer: { type: 'string', minLength: 1 },
    internalCode: { type: 'string', minLength: 1 },
    technicalNotes: { type: 'string', minLength: 1 },
  },
};

module.exports = {
  id: 'stock-availability',
  name: 'Stock Availability',
  version: '0.1.0',
  capability: {
    id: 'stock.availability',
    name: 'Stock Availability',
    version: '0.1.0',
    description: 'Returns locally mocked stock availability for a compatible vehicle part.',
    inputContract: {
      type: 'object',
      required: ['vehicle', 'part'],
      properties: {
        vehicle: vehicleContract,
        part: partContract,
      },
    },
    resultContract: {
      type: 'object',
      required: [
        'source',
        'vehicle',
        'part',
        'available',
        'quantity',
        'branch',
        'estimatedDelivery',
        'notes',
      ],
      properties: {
        source: { type: 'string', minLength: 1 },
        vehicle: vehicleContract,
        part: partContract,
        available: { type: 'boolean' },
        quantity: { type: 'integer', minimum: 0 },
        branch: { type: 'string', minLength: 1 },
        estimatedDelivery: { type: 'string', minLength: 1 },
        notes: { type: 'string', minLength: 1 },
      },
    },
    outputContract: {
      success: {
        ok: true,
        available: 'boolean',
        quantity: 'integer',
        branch: 'string',
        estimatedDelivery: 'string',
        notes: 'string',
        auditId: 'string',
      },
      failure: {
        ok: false,
        error: {
          code: 'string',
          message: 'string',
        },
        auditId: 'string',
      },
    },
  },
  execute(input, _executionContext = {}) {
    const stock = STOCK_BY_INTERNAL_CODE[input.part.internalCode];

    return {
      source: 'mock',
      vehicle: input.vehicle,
      part: input.part,
      ...stock,
    };
  },
};
