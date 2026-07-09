const { contracts, objectContract } = require('../../domain/contracts');

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

module.exports = {
  id: 'stock-availability',
  name: 'Stock Availability',
  version: '0.1.0',
  capability: {
    id: 'stock.availability',
    name: 'Stock Availability',
    version: '0.1.0',
    description: 'Returns locally mocked stock availability for a compatible vehicle part.',
    inputContract: objectContract(
      ['vehicle', 'part'],
      {
        vehicle: contracts.vehicle,
        part: contracts.part,
      }
    ),
    resultContract: objectContract(
      [
        'source',
        'vehicle',
        'part',
        'available',
        'quantity',
        'branch',
        'estimatedDelivery',
        'notes',
      ],
      {
        source: contracts.nonEmptyString,
        vehicle: contracts.vehicle,
        part: contracts.part,
        available: { type: 'boolean' },
        quantity: { type: 'integer', minimum: 0 },
        branch: contracts.nonEmptyString,
        estimatedDelivery: contracts.nonEmptyString,
        notes: contracts.nonEmptyString,
      }
    ),
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
