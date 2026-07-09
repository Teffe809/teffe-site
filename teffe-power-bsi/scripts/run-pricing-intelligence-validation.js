const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { bootPlatform } = require('../platform');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function serviceResult(response) {
  return {
    source: response.source,
    system: response.system,
    relatedComponents: response.relatedComponents,
    recommendations: response.recommendations,
    priority: response.priority,
    technicalJustification: response.technicalJustification,
  };
}

function recommendationResult(response) {
  return {
    source: response.source,
    complementaryComponents: response.complementaryComponents,
    suggestedKits: response.suggestedKits,
    preventiveRecommendations: response.preventiveRecommendations,
    technicalJustification: response.technicalJustification,
    priority: response.priority,
    confidence: response.confidence,
  };
}

function budgetResult(response) {
  return {
    source: response.source,
    vehicle: response.vehicle,
    category: response.category,
    mainItem: response.mainItem,
    complementaryItems: response.complementaryItems,
    systemGroups: response.systemGroups,
    technicalKits: response.technicalKits,
    sellerNotes: response.sellerNotes,
    auditId: response.auditId,
  };
}

function waitForServer(child, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('HTTP server startup timed out')), timeoutMs);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Teffe Power BSI')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`HTTP server exited before validation with code ${code}`));
    });
  });
}

async function validateHttp(budget) {
  const port = 37000 + (process.pid % 1000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const success = await fetch(`http://127.0.0.1:${port}/capabilities/pricing`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ budget, userId: 'http-pricing-user' }),
    });
    const successBody = await success.json();
    assert(success.status === 200, `expected HTTP 200, got ${success.status}`);
    assert(successBody.ok === true, 'HTTP Pricing Intelligence success missing');
    assert(successBody.totals?.total === null, 'HTTP pricing total must remain null');

    const failure = await fetch(`http://127.0.0.1:${port}/capabilities/pricing`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ budget: {} }),
    });
    const failureBody = await failure.json();
    assert(failure.status === 400, `expected HTTP 400, got ${failure.status}`);
    assert(
      failureBody.error?.code === 'capability_input_contract_invalid',
      'HTTP empty budget error mismatch'
    );

    return {
      endpoint: '/capabilities/pricing',
      successStatus: success.status,
      failureStatus: failure.status,
    };
  } finally {
    child.kill();
  }
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-pricing-'));
  const platform = bootPlatform({ dataDir });
  const { miaCore, capabilityRegistry, capabilityDiscovery } = platform.engines;

  assert(platform.status === 'ok', 'platform boot failed');
  assert(platform.plugins.includes('pricing-intelligence'), 'Pricing Intelligence plugin not loaded');
  assert(capabilityRegistry.has('pricing.intelligence'), 'Pricing Intelligence not registered');

  const discovered = capabilityDiscovery.findById('pricing.intelligence');
  assert(discovered?.pluginId === 'pricing-intelligence', 'Pricing Intelligence mapping missing');
  assert(discovered?.inputContract?.required?.includes('budget'), 'budget input contract missing');
  assert(discovered?.resultContract?.properties?.totals, 'pricing totals contract missing');
  assert(!discovered?.requirements?.includes('domainKnowledge'), 'Pricing must not require DKE');

  const identification = miaCore.handleManualVehicleIdentification({
    plate: 'ABC-1D23',
    userId: 'pricing-validation-user',
  });
  assert(identification.ok === true, 'vehicle identification failed');

  const compatibility = miaCore.handleVehicleCompatibility({
    vehicle: identification.vehicle,
    category: 'suspensao',
    userId: 'pricing-validation-user',
  });
  assert(compatibility.ok === true, 'vehicle compatibility failed');
  const part = compatibility.compatibleParts[0];

  const service = miaCore.handleServiceIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    userId: 'pricing-validation-user',
  });
  assert(service.ok === true, 'Service Intelligence regression failed');
  const intelligence = serviceResult(service);

  const recommendation = miaCore.handleRecommendation({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    serviceIntelligence: intelligence,
    userId: 'pricing-validation-user',
  });
  assert(recommendation.ok === true, 'Recommendation Engine regression failed');

  const budget = miaCore.handleBudgetIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    serviceIntelligence: intelligence,
    recommendation: recommendationResult(recommendation),
    userId: 'pricing-validation-user',
  });
  assert(budget.ok === true, 'Budget Intelligence regression failed');
  const budgetInput = budgetResult(budget);

  const pricing = miaCore.handlePricingIntelligence({
    budget: budgetInput,
    userId: 'pricing-validation-user',
  });
  assert(pricing.ok === true, 'Pricing Intelligence execution failed');
  assert(pricing.source === 'budget-intelligence', 'pricing source mismatch');
  assert(pricing.budgetAuditId === budget.auditId, 'budget audit reference mismatch');
  assert(
    pricing.items.length === 1 + budget.complementaryItems.length,
    'commercial item count mismatch'
  );
  assert(pricing.items.every((item) => item.pricing.status === 'pending'), 'pricing status mismatch');
  assert(pricing.items.every((item) => item.pricing.quantity === null), 'quantity must remain null');
  assert(pricing.items.every((item) => item.pricing.unitPrice === null), 'unit price must remain null');
  assert(pricing.items.every((item) => item.pricing.subtotal === null), 'subtotal must remain null');
  assert(pricing.items.every((item) => item.discount.amount === null), 'discount must remain null');
  assert(pricing.items.every((item) => item.taxes.amount === null), 'tax must remain null');
  assert(pricing.items.every((item) => item.margin.amount === null), 'margin must remain null');
  assert(pricing.discounts.applied.length === 0, 'discounts must not be applied');
  assert(pricing.taxes.applied.length === 0, 'taxes must not be applied');
  assert(pricing.margin.amount === null, 'global margin must remain null');
  assert(pricing.validity.days === null, 'validity days must remain null');
  assert(pricing.validity.validUntil === null, 'validity date must remain null');
  assert(pricing.totals.total === null, 'commercial total must remain null');
  assert(pricing.totals.currency === null, 'currency must remain null');
  assert(pricing.commercialNotes.length > budget.sellerNotes.length, 'commercial note missing');
  assert(pricing.auditId, 'pricing auditId missing');

  const latestExecution = platform.engines.memoryEngine.latestExecution();
  assert(latestExecution.capability === 'pricing.intelligence', 'pricing context not persisted');
  assert(latestExecution.executionContext.runtime.intent === 'pricing.intelligence', 'pricing intent missing');

  const emptyBudget = miaCore.handlePricingIntelligence({ budget: {} });
  assert(emptyBudget.ok === false, 'empty budget must fail');
  assert(
    emptyBudget.error?.code === 'capability_input_contract_invalid',
    'empty budget contract code mismatch'
  );

  const invalidSource = miaCore.handlePricingIntelligence({
    budget: { ...budgetInput, source: 'manual' },
  });
  assert(invalidSource.ok === false, 'invalid budget source must fail');
  assert(invalidSource.error?.code === 'budget_source_invalid', 'invalid budget source code mismatch');

  const invalidItems = miaCore.handlePricingIntelligence({
    budget: {
      ...budgetInput,
      mainItem: {
        ...budgetInput.mainItem,
        priority: null,
      },
    },
  });
  assert(invalidItems.ok === false, 'invalid budget item must fail');
  assert(
    invalidItems.error?.code === 'capability_input_contract_invalid',
    'invalid budget item contract code mismatch'
  );

  const pricingPlugin = platform.engines.pluginEngine.plugins.get('pricing-intelligence');
  const originalExecute = pricingPlugin.execute;
  pricingPlugin.execute = () => ({
    source: 'budget-intelligence',
    items: [],
  });
  const invalidResult = miaCore.handlePricingIntelligence({ budget: budgetInput });
  pricingPlugin.execute = originalExecute;
  assert(invalidResult.ok === false, 'invalid pricing result must fail');
  assert(
    invalidResult.error?.code === 'capability_result_contract_invalid',
    'invalid pricing result contract mismatch'
  );

  const persistedContext = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'context-store.json'), 'utf8')
  );
  assert(persistedContext.executions.length === 6, 'only six successful executions must persist');

  const http = await validateHttp(budgetInput);

  console.log(JSON.stringify({
    pass: true,
    capability: {
      id: discovered.id,
      pluginId: discovered.pluginId,
      source: pricing.source,
    },
    commercialStructure: {
      items: pricing.items.length,
      pricesCalculated: false,
      discountsCalculated: false,
      taxesCalculated: false,
      marginCalculated: false,
      validityDefined: false,
      budgetAuditId: pricing.budgetAuditId,
      auditId: pricing.auditId,
    },
    negativeTests: [emptyBudget, invalidSource, invalidItems, invalidResult]
      .map(({ ok, error, auditId }) => ({ ok, error, auditId })),
    coverage: {
      sharedDomainContracts: true,
      registry: true,
      discovery: true,
      contracts: true,
      executionContext: true,
      budgetIntelligence: true,
      emptyBudget: true,
      noFinancialCalculation: true,
      audit: true,
      memory: true,
      http: true,
    },
    memory: {
      executions: persistedContext.executions.length,
    },
    http,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ pass: false, error: error.message }, null, 2));
  process.exit(1);
});
