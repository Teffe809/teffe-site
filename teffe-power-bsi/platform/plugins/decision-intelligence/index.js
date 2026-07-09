const { contracts, objectContract } = require('../../domain/contracts');
const { CapabilityError } = require('../../sdk');

module.exports = {
  id: 'decision-intelligence',
  name: 'Decision Intelligence',
  version: '0.1.0',
  capability: {
    id: 'decision.intelligence',
    name: 'Decision Intelligence',
    version: '0.1.0',
    description: 'Transforms commercial intelligence into deterministic business decisions.',
    requirements: ['decisionRules'],
    inputContract: objectContract(
      ['pricing'],
      {
        pricing: contracts.pricingIntelligence,
      }
    ),
    resultContract: contracts.decisionIntelligence,
    outputContract: {
      success: {
        ok: true,
        decisions: 'array',
        summary: 'object',
        justifications: 'array',
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
    if (!decisionRules) {
      throw new CapabilityError(
        'decision_rules_unavailable',
        'Decision Rules Engine is required for Decision Intelligence'
      );
    }

    return {
      source: 'pricing-intelligence',
      pricingAuditId: input.pricing.auditId ?? null,
      ...decisionRules.evaluate(input.pricing),
    };
  },
};
