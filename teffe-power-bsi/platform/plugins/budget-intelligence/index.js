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

const recommendationContract = {
  type: 'object',
  required: [
    'source',
    'complementaryComponents',
    'suggestedKits',
    'preventiveRecommendations',
    'technicalJustification',
    'priority',
    'confidence',
  ],
  properties: {
    source: { type: 'string', minLength: 1 },
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
      items: { type: 'string', minLength: 1 },
    },
    technicalJustification: { type: 'string', minLength: 1 },
    priority: { type: 'string', minLength: 1 },
    confidence: { type: 'string', minLength: 1 },
  },
};

const budgetItemContract = {
  type: 'object',
  required: ['type', 'name', 'priority', 'technicalJustification'],
  properties: {
    type: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    manufacturer: { type: 'string', minLength: 1 },
    internalCode: { type: 'string', minLength: 1 },
    priority: { type: 'string', minLength: 1 },
    technicalJustification: { type: 'string', minLength: 1 },
  },
};

module.exports = {
  id: 'budget-intelligence',
  name: 'Budget Intelligence',
  version: '0.1.0',
  capability: {
    id: 'budget.intelligence',
    name: 'Budget Intelligence',
    version: '0.1.0',
    description: 'Builds a non-financial technical budget from intelligence and recommendations.',
    requirements: ['domainKnowledge'],
    inputContract: {
      type: 'object',
      required: ['vehicle', 'part', 'category', 'serviceIntelligence', 'recommendation'],
      properties: {
        vehicle: vehicleContract,
        part: partContract,
        category: { type: 'string', minLength: 1 },
        serviceIntelligence: serviceIntelligenceContract,
        recommendation: recommendationContract,
      },
    },
    resultContract: {
      type: 'object',
      required: [
        'source',
        'vehicle',
        'category',
        'mainItem',
        'complementaryItems',
        'systemGroups',
        'technicalKits',
        'sellerNotes',
      ],
      properties: {
        source: { type: 'string', minLength: 1 },
        vehicle: vehicleContract,
        category: { type: 'string', minLength: 1 },
        mainItem: budgetItemContract,
        complementaryItems: {
          type: 'array',
          items: budgetItemContract,
        },
        systemGroups: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['system', 'items'],
            properties: {
              system: {
                type: 'object',
                required: ['id', 'name'],
                properties: {
                  id: { type: 'string', minLength: 1 },
                  name: { type: 'string', minLength: 1 },
                },
              },
              items: {
                type: 'array',
                minItems: 1,
                items: { type: 'string', minLength: 1 },
              },
            },
          },
        },
        technicalKits: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'components', 'priority'],
            properties: {
              name: { type: 'string', minLength: 1 },
              components: {
                type: 'array',
                minItems: 1,
                items: { type: 'string', minLength: 1 },
              },
              priority: { type: 'string', minLength: 1 },
            },
          },
        },
        sellerNotes: {
          type: 'array',
          minItems: 1,
          items: { type: 'string', minLength: 1 },
        },
      },
    },
    outputContract: {
      success: {
        ok: true,
        mainItem: 'object',
        complementaryItems: 'array',
        systemGroups: 'array',
        technicalKits: 'array',
        sellerNotes: 'array',
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
        'Domain Knowledge Engine is required for Budget Intelligence'
      );
    }

    const budget = dke.getBudgetStructure({
      category: input.category,
      part: input.part,
      serviceIntelligence: input.serviceIntelligence,
      recommendation: input.recommendation,
    });
    if (!budget) {
      throw new CapabilityError(
        'budget_knowledge_mismatch',
        'Budget inputs do not match the requested domain category'
      );
    }

    return {
      source: 'service-intelligence+recommendation-engine+domain-knowledge-engine',
      vehicle: input.vehicle,
      category: input.category,
      ...budget,
    };
  },
};
