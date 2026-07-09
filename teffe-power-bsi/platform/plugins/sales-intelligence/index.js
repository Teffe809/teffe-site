const { contracts, objectContract } = require('../../domain/contracts');
const { CapabilityError } = require('../../sdk');

module.exports = {
  id: 'sales-intelligence',
  name: 'Sales Intelligence',
  version: '0.1.0',
  capability: {
    id: 'sales.intelligence',
    name: 'Sales Intelligence',
    version: '0.1.0',
    description: 'Builds reusable sales strategies from pricing, decisions and registered libraries.',
    requirements: ['decisionRules', 'libraries'],
    inputContract: objectContract(
      ['pricing', 'decision'],
      {
        pricing: contracts.pricingIntelligence,
        decision: contracts.decisionIntelligence,
      }
    ),
    resultContract: contracts.salesIntelligence,
    outputContract: {
      success: {
        ok: true,
        library: 'object',
        complementarySaleOpportunity: 'object',
        commercialPriority: 'string',
        technicalJustification: 'string',
        suggestedApproach: 'string',
        requiresHuman: 'boolean',
        commercialRisks: 'array',
        nextSteps: 'array',
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
    const decisionRules = executionContext.services?.decisionRules;
    const libraries = executionContext.services?.libraries;
    if (!decisionRules || !libraries) {
      throw new CapabilityError(
        'sales_runtime_unavailable',
        'Decision Rules Engine and Library Registry are required for Sales Intelligence'
      );
    }

    const library = libraries.findForConsumer('sales.intelligence', 'commercial');
    if (!library) {
      throw new CapabilityError(
        'sales_library_not_found',
        'No active Commercial Library is registered for Sales Intelligence'
      );
    }

    return {
      source: 'decision-rules-engine+library-registry',
      pricingAuditId: input.pricing.auditId ?? null,
      decisionAuditId: input.decision.auditId ?? null,
      ...decisionRules.buildSalesStrategy({
        pricing: input.pricing,
        decision: input.decision,
        library,
      }),
    };
  },
};
