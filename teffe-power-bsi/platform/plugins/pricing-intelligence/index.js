const { contracts, objectContract } = require('../../domain/contracts');

function pendingAdjustment() {
  return {
    status: 'pending',
    type: null,
    value: null,
    amount: null,
  };
}

function toPricingItem(item, index) {
  return {
    id: `item_${index + 1}`,
    type: item.type,
    description: item.name,
    internalCode: item.internalCode ?? null,
    pricing: {
      status: 'pending',
      quantity: null,
      unitPrice: null,
      subtotal: null,
      currency: null,
    },
    discount: pendingAdjustment(),
    taxes: pendingAdjustment(),
    margin: pendingAdjustment(),
  };
}

module.exports = {
  id: 'pricing-intelligence',
  name: 'Pricing Intelligence',
  version: '0.1.0',
  capability: {
    id: 'pricing.intelligence',
    name: 'Pricing Intelligence',
    version: '0.1.0',
    description: 'Prepares a commercial budget structure without calculating financial values.',
    inputContract: objectContract(
      ['budget'],
      {
        budget: contracts.budgetIntelligenceResult,
      }
    ),
    resultContract: contracts.pricingIntelligence,
    outputContract: {
      success: {
        ok: true,
        items: 'array',
        discounts: 'object',
        taxes: 'object',
        margin: 'object',
        validity: 'object',
        totals: 'object',
        commercialNotes: 'array',
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
    const budgetItems = [
      input.budget.mainItem,
      ...input.budget.complementaryItems,
    ];

    return {
      source: 'budget-intelligence',
      budgetAuditId: input.budget.auditId ?? null,
      items: budgetItems.map(toPricingItem),
      discounts: {
        status: 'pending',
        applied: [],
        total: null,
      },
      taxes: {
        status: 'pending',
        applied: [],
        total: null,
      },
      margin: pendingAdjustment(),
      validity: {
        status: 'pending',
        days: null,
        validUntil: null,
      },
      totals: {
        status: 'pending',
        subtotal: null,
        discounts: null,
        taxes: null,
        total: null,
        currency: null,
      },
      commercialNotes: [
        ...input.budget.sellerNotes,
        'Valores comerciais pendentes de integracao.',
      ],
    };
  },
};
