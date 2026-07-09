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

const serviceIntelligenceContract = {
  type: 'object',
  required: [
    'source',
    'system',
    'relatedComponents',
    'recommendations',
    'priority',
    'technicalJustification',
  ],
  properties: {
    source: { type: 'string', minLength: 1 },
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
};

module.exports = {
  id: 'recommendation-engine',
  name: 'Recommendation Engine',
  version: '0.1.0',
  capability: {
    id: 'recommendation.engine',
    name: 'Recommendation Engine',
    version: '0.1.0',
    description: 'Builds reusable recommendations from Service Intelligence and Domain Knowledge.',
    requirements: ['domainKnowledge'],
    inputContract: {
      type: 'object',
      required: ['vehicle', 'part', 'category', 'serviceIntelligence'],
      properties: {
        vehicle: vehicleContract,
        part: partContract,
        category: { type: 'string', minLength: 1 },
        serviceIntelligence: serviceIntelligenceContract,
      },
    },
    resultContract: {
      type: 'object',
      required: [
        'source',
        'vehicle',
        'part',
        'category',
        'complementaryComponents',
        'suggestedKits',
        'preventiveRecommendations',
        'technicalJustification',
        'priority',
        'confidence',
      ],
      properties: {
        source: { type: 'string', minLength: 1 },
        vehicle: vehicleContract,
        part: partContract,
        category: { type: 'string', minLength: 1 },
        complementaryComponents: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
        },
        suggestedKits: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'components'],
            properties: {
              name: { type: 'string', minLength: 1 },
              components: {
                type: 'array',
                minItems: 1,
                items: { type: 'string', minLength: 1 },
              },
            },
          },
        },
        preventiveRecommendations: {
          type: 'array',
          minItems: 1,
          items: { type: 'string', minLength: 1 },
        },
        technicalJustification: { type: 'string', minLength: 1 },
        priority: { type: 'string', minLength: 1 },
        confidence: { type: 'string', minLength: 1 },
      },
    },
    outputContract: {
      success: {
        ok: true,
        complementaryComponents: 'array',
        suggestedKits: 'array',
        preventiveRecommendations: 'array',
        technicalJustification: 'string',
        priority: 'string',
        confidence: 'string',
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
        'Domain Knowledge Engine is required for Recommendation Engine'
      );
    }

    const recommendation = dke.getRecommendations({
      category: input.category,
      component: input.part.name,
      serviceIntelligence: input.serviceIntelligence,
    });
    if (!recommendation) {
      throw new CapabilityError(
        'recommendation_knowledge_mismatch',
        'Service Intelligence does not match the requested domain category'
      );
    }

    return {
      source: 'service-intelligence+domain-knowledge-engine',
      vehicle: input.vehicle,
      part: input.part,
      category: input.category,
      ...recommendation,
    };
  },
};
