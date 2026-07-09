const { CapabilityError } = require('../../sdk');
const { contracts, objectContract } = require('../../domain/contracts');

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
    inputContract: objectContract(
      ['vehicle', 'part', 'category', 'serviceIntelligence'],
      {
        vehicle: contracts.vehicle,
        part: contracts.part,
        category: contracts.category,
        serviceIntelligence: contracts.serviceIntelligence,
      }
    ),
    resultContract: objectContract(
      ['vehicle', 'part', 'category', ...contracts.recommendation.required],
      {
        vehicle: contracts.vehicle,
        part: contracts.part,
        category: contracts.category,
        ...contracts.recommendation.properties,
      }
    ),
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
