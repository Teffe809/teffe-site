const PARTS_BY_CATEGORY = {
  freios: [
    {
      name: 'Jogo de pastilhas dianteiras',
      manufacturer: 'Fras-le',
      internalCode: 'TFF-FRE-001',
      technicalNotes: 'Aplicacao mock para eixo dianteiro; conferir espessura do disco.',
    },
    {
      name: 'Disco de freio ventilado',
      manufacturer: 'Fremax',
      internalCode: 'TFF-FRE-002',
      technicalNotes: 'Aplicacao mock por par; montagem no eixo dianteiro.',
    },
  ],
  suspensao: [
    {
      name: 'Amortecedor dianteiro',
      manufacturer: 'Cofap',
      internalCode: 'TFF-SUS-001',
      technicalNotes: 'Aplicacao mock; substituir aos pares e inspecionar batentes.',
    },
  ],
  motor: [
    {
      name: 'Kit correia de acessorios',
      manufacturer: 'Gates',
      internalCode: 'TFF-MOT-001',
      technicalNotes: 'Aplicacao mock; validar tensionador durante a instalacao.',
    },
  ],
  filtros: [
    {
      name: 'Filtro de oleo',
      manufacturer: 'Tecfil',
      internalCode: 'TFF-FIL-001',
      technicalNotes: 'Aplicacao mock; seguir torque e intervalo do fabricante.',
    },
    {
      name: 'Filtro de ar do motor',
      manufacturer: 'Mann-Filter',
      internalCode: 'TFF-FIL-002',
      technicalNotes: 'Aplicacao mock; conferir alojamento antes da instalacao.',
    },
  ],
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
  id: 'vehicle-compatibility',
  name: 'Vehicle Compatibility',
  version: '0.1.0',
  capability: {
    id: 'vehicle.compatibility',
    name: 'Vehicle Compatibility',
    version: '0.1.0',
    description: 'Returns locally mocked compatible parts for an identified vehicle and part category.',
    inputContract: {
      type: 'object',
      required: ['vehicle', 'category'],
      properties: {
        vehicle: vehicleContract,
        category: { type: 'string', minLength: 1 },
      },
    },
    resultContract: {
      type: 'object',
      required: ['source', 'vehicle', 'category', 'compatibleParts'],
      properties: {
        source: { type: 'string', minLength: 1 },
        vehicle: vehicleContract,
        category: { type: 'string', minLength: 1 },
        compatibleParts: {
          type: 'array',
          minItems: 1,
          items: partContract,
        },
      },
    },
    outputContract: {
      success: {
        ok: true,
        vehicle: 'object',
        category: 'string',
        compatibleParts: 'array',
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
    return {
      source: 'mock',
      vehicle: input.vehicle,
      category: input.category,
      compatibleParts: PARTS_BY_CATEGORY[input.category],
    };
  },
};
