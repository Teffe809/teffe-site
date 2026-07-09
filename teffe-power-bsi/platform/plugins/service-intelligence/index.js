const { CapabilityError } = require('../../sdk');

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
  id: 'service-intelligence',
  name: 'Service Intelligence',
  version: '0.1.0',
  capability: {
    id: 'service.intelligence',
    name: 'Service Intelligence',
    version: '0.1.0',
    description: 'Produces service intelligence exclusively from the Domain Knowledge Engine.',
    requirements: ['domainKnowledge'],
    inputContract: {
      type: 'object',
      required: ['vehicle', 'part', 'category'],
      properties: {
        vehicle: vehicleContract,
        part: partContract,
        category: { type: 'string', minLength: 1 },
      },
    },
    resultContract: {
      type: 'object',
      required: [
        'source',
        'vehicle',
        'part',
        'category',
        'system',
        'relatedComponents',
        'recommendations',
        'priority',
        'technicalJustification',
      ],
      properties: {
        source: { type: 'string', minLength: 1 },
        vehicle: vehicleContract,
        part: partContract,
        category: { type: 'string', minLength: 1 },
        system: {
          type: 'object',
          required: ['id', 'name', 'description'],
          properties: {
            id: { type: 'string', minLength: 1 },
            name: { type: 'string', minLength: 1 },
            description: { type: 'string', minLength: 1 },
          },
        },
        relatedComponents: {
          type: 'array',
          minItems: 1,
          items: { type: 'string', minLength: 1 },
        },
        recommendations: {
          type: 'array',
          minItems: 1,
          items: { type: 'string', minLength: 1 },
        },
        priority: { type: 'string', minLength: 1 },
        technicalJustification: { type: 'string', minLength: 1 },
      },
    },
    outputContract: {
      success: {
        ok: true,
        system: 'object',
        relatedComponents: 'array',
        recommendations: 'array',
        priority: 'string',
        technicalJustification: 'string',
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
  execute(input, executionContext) {
    const dke = executionContext.services?.domainKnowledge;
    if (!dke) {
      throw new CapabilityError(
        'domain_knowledge_unavailable',
        'Domain Knowledge Engine is required for Service Intelligence'
      );
    }

    const intelligence = dke.getServiceIntelligence({
      category: input.category,
      component: input.part.name,
    });
    if (!intelligence) {
      throw new CapabilityError(
        'domain_system_not_found',
        'No domain system was found for the provided category and component'
      );
    }

    return {
      source: 'domain-knowledge-engine',
      vehicle: input.vehicle,
      part: input.part,
      category: input.category,
      ...intelligence,
    };
  },
};
