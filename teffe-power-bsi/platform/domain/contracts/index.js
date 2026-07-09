function objectContract(required, properties) {
  return {
    type: 'object',
    required,
    properties,
  };
}

function arrayContract(items, options = {}) {
  return {
    type: 'array',
    items,
    ...options,
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const nonEmptyString = { type: 'string', minLength: 1 };
const category = nonEmptyString;
const rawPlate = { type: 'string' };
const plate = { type: 'string', minLength: 7, maxLength: 7 };

const vehicle = objectContract(
  ['plate', 'brand', 'model', 'year'],
  {
    plate,
    brand: nonEmptyString,
    model: nonEmptyString,
    year: { type: 'integer' },
  }
);

const part = objectContract(
  ['name', 'manufacturer', 'internalCode', 'technicalNotes'],
  {
    name: nonEmptyString,
    manufacturer: nonEmptyString,
    internalCode: nonEmptyString,
    technicalNotes: nonEmptyString,
  }
);

const system = objectContract(
  ['id', 'name', 'description'],
  {
    id: nonEmptyString,
    name: nonEmptyString,
    description: nonEmptyString,
  }
);

const technicalKit = objectContract(
  ['name', 'components'],
  {
    name: nonEmptyString,
    components: arrayContract(nonEmptyString, { minItems: 1 }),
  }
);

const serviceIntelligence = objectContract(
  [
    'source',
    'system',
    'relatedComponents',
    'recommendations',
    'priority',
    'technicalJustification',
  ],
  {
    source: nonEmptyString,
    system,
    relatedComponents: arrayContract(nonEmptyString),
    recommendations: arrayContract(nonEmptyString),
    priority: nonEmptyString,
    technicalJustification: nonEmptyString,
  }
);

const recommendation = objectContract(
  [
    'source',
    'complementaryComponents',
    'suggestedKits',
    'preventiveRecommendations',
    'technicalJustification',
    'priority',
    'confidence',
  ],
  {
    source: nonEmptyString,
    complementaryComponents: arrayContract(nonEmptyString),
    suggestedKits: arrayContract(technicalKit),
    preventiveRecommendations: arrayContract(nonEmptyString),
    technicalJustification: nonEmptyString,
    priority: nonEmptyString,
    confidence: nonEmptyString,
  }
);

const budgetItem = objectContract(
  ['type', 'name', 'priority', 'technicalJustification'],
  {
    type: nonEmptyString,
    name: nonEmptyString,
    manufacturer: nonEmptyString,
    internalCode: nonEmptyString,
    priority: nonEmptyString,
    technicalJustification: nonEmptyString,
  }
);

const budgetSystemGroup = objectContract(
  ['system', 'items'],
  {
    system: objectContract(
      ['id', 'name'],
      {
        id: nonEmptyString,
        name: nonEmptyString,
      }
    ),
    items: arrayContract(nonEmptyString, { minItems: 1 }),
  }
);

const budgetTechnicalKit = objectContract(
  ['name', 'components', 'priority'],
  {
    ...technicalKit.properties,
    priority: nonEmptyString,
  }
);

const budgetIntelligence = objectContract(
  ['mainItem', 'complementaryItems', 'systemGroups', 'technicalKits', 'sellerNotes'],
  {
    mainItem: budgetItem,
    complementaryItems: arrayContract(budgetItem),
    systemGroups: arrayContract(budgetSystemGroup, { minItems: 1 }),
    technicalKits: arrayContract(budgetTechnicalKit),
    sellerNotes: arrayContract(nonEmptyString, { minItems: 1 }),
  }
);

const budgetIntelligenceResult = objectContract(
  ['source', 'vehicle', 'category', ...budgetIntelligence.required],
  {
    source: nonEmptyString,
    vehicle,
    category,
    ...budgetIntelligence.properties,
  }
);

const nullableString = { type: ['string', 'null'] };
const nullableNumber = { type: ['number', 'null'] };
const nullableInteger = { type: ['integer', 'null'] };

const commercialAdjustment = objectContract(
  ['status', 'type', 'value', 'amount'],
  {
    status: nonEmptyString,
    type: nullableString,
    value: nullableNumber,
    amount: nullableNumber,
  }
);

const pricingItem = objectContract(
  ['id', 'type', 'description', 'internalCode', 'pricing', 'discount', 'taxes', 'margin'],
  {
    id: nonEmptyString,
    type: nonEmptyString,
    description: nonEmptyString,
    internalCode: nullableString,
    pricing: objectContract(
      ['status', 'quantity', 'unitPrice', 'subtotal', 'currency'],
      {
        status: nonEmptyString,
        quantity: nullableInteger,
        unitPrice: nullableNumber,
        subtotal: nullableNumber,
        currency: nullableString,
      }
    ),
    discount: commercialAdjustment,
    taxes: commercialAdjustment,
    margin: commercialAdjustment,
  }
);

const pricingIntelligence = objectContract(
  [
    'source',
    'budgetAuditId',
    'items',
    'discounts',
    'taxes',
    'margin',
    'validity',
    'totals',
    'commercialNotes',
  ],
  {
    source: nonEmptyString,
    budgetAuditId: nullableString,
    items: arrayContract(pricingItem, { minItems: 1 }),
    discounts: objectContract(
      ['status', 'applied', 'total'],
      {
        status: nonEmptyString,
        applied: arrayContract(commercialAdjustment),
        total: nullableNumber,
      }
    ),
    taxes: objectContract(
      ['status', 'applied', 'total'],
      {
        status: nonEmptyString,
        applied: arrayContract(commercialAdjustment),
        total: nullableNumber,
      }
    ),
    margin: commercialAdjustment,
    validity: objectContract(
      ['status', 'days', 'validUntil'],
      {
        status: nonEmptyString,
        days: nullableInteger,
        validUntil: nullableString,
      }
    ),
    totals: objectContract(
      ['status', 'subtotal', 'discounts', 'taxes', 'total', 'currency'],
      {
        status: nonEmptyString,
        subtotal: nullableNumber,
        discounts: nullableNumber,
        taxes: nullableNumber,
        total: nullableNumber,
        currency: nullableString,
      }
    ),
    commercialNotes: arrayContract(nonEmptyString, { minItems: 1 }),
  }
);

const decisionType = {
  type: 'string',
  enum: [
    'suggest_complementary_sale',
    'suggest_kit',
    'request_more_information',
    'route_to_human',
    'await_stock',
    'proceed_to_budget',
  ],
};

const decision = objectContract(
  ['id', 'type', 'priority', 'reason', 'nextAction', 'relatedItemIds'],
  {
    id: nonEmptyString,
    type: decisionType,
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'critical'],
    },
    reason: nonEmptyString,
    nextAction: nonEmptyString,
    relatedItemIds: arrayContract(nonEmptyString),
  }
);

const decisionIntelligence = objectContract(
  ['source', 'pricingAuditId', 'decisions', 'summary', 'justifications'],
  {
    source: nonEmptyString,
    pricingAuditId: nullableString,
    decisions: arrayContract(decision, { minItems: 1 }),
    summary: objectContract(
      ['canProceed', 'requiresHuman', 'awaitingInformation', 'awaitingStock', 'decisionCount'],
      {
        canProceed: { type: 'boolean' },
        requiresHuman: { type: 'boolean' },
        awaitingInformation: { type: 'boolean' },
        awaitingStock: { type: 'boolean' },
        decisionCount: { type: 'integer', minimum: 1 },
      }
    ),
    justifications: arrayContract(nonEmptyString, { minItems: 1 }),
  }
);

const contracts = deepFreeze({
  nonEmptyString,
  rawPlate,
  plate,
  vehicle,
  part,
  category,
  system,
  technicalKit,
  serviceIntelligence,
  recommendation,
  budgetItem,
  budgetSystemGroup,
  budgetTechnicalKit,
  budgetIntelligence,
  budgetIntelligenceResult,
  commercialAdjustment,
  pricingItem,
  pricingIntelligence,
  decisionType,
  decision,
  decisionIntelligence,
});

module.exports = {
  arrayContract,
  objectContract,
  contracts,
};
