const { CapabilityError } = require('../../sdk');
const { contracts, objectContract } = require('../../domain/contracts');

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
    inputContract: objectContract(
      ['vehicle', 'part', 'category', 'serviceIntelligence', 'recommendation'],
      {
        vehicle: contracts.vehicle,
        part: contracts.part,
        category: contracts.category,
        serviceIntelligence: contracts.serviceIntelligence,
        recommendation: contracts.recommendation,
      }
    ),
    resultContract: contracts.budgetIntelligenceResult,
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
