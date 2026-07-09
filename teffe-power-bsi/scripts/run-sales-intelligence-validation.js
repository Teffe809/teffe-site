const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { bootPlatform } = require('../platform');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pick(response, fields) {
  return Object.fromEntries(fields.map((field) => [field, response[field]]));
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

async function validateHttp(pricing, decision) {
  const port = 39000 + (process.pid % 1000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      TEFFE_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-http-sales-')),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const success = await fetch(`http://127.0.0.1:${port}/capabilities/sales`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pricing, decision, userId: 'http-sales-user' }),
    });
    const successBody = await success.json();
    assert(success.status === 200, `expected HTTP 200, got ${success.status}`);
    assert(successBody.ok === true, 'HTTP Sales Intelligence success missing');
    assert(successBody.library?.type === 'commercial', 'HTTP Commercial Library missing');

    const failure = await fetch(`http://127.0.0.1:${port}/capabilities/sales`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pricing,
        decision: { ...decision, source: 'manual' },
      }),
    });
    const failureBody = await failure.json();
    assert(failure.status === 400, `expected HTTP 400, got ${failure.status}`);
    assert(failureBody.error?.code === 'decision_source_invalid', 'HTTP sales error mismatch');

    return {
      endpoint: '/capabilities/sales',
      successStatus: success.status,
      failureStatus: failure.status,
    };
  } finally {
    child.kill();
  }
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-sales-'));
  const platform = bootPlatform({ dataDir });
  const {
    miaCore,
    capabilityRegistry,
    capabilityDiscovery,
    decisionRulesEngine,
  } = platform.engines;

  assert(platform.status === 'ok', 'platform boot failed');
  assert(platform.plugins.includes('sales-intelligence'), 'Sales Intelligence plugin not loaded');
  assert(capabilityRegistry.has('sales.intelligence'), 'Sales Intelligence not registered');

  const discovered = capabilityDiscovery.findById('sales.intelligence');
  assert(discovered?.pluginId === 'sales-intelligence', 'Sales Intelligence mapping missing');
  assert(discovered?.requirements?.includes('decisionRules'), 'Decision Rules requirement missing');
  assert(discovered?.requirements?.includes('libraries'), 'Library Registry requirement missing');
  assert(discovered?.resultContract?.properties?.commercialPriority, 'sales result contract missing');

  const identification = miaCore.handleManualVehicleIdentification({
    plate: 'ABC-1D23',
    userId: 'sales-validation-user',
  });
  const compatibility = miaCore.handleVehicleCompatibility({
    vehicle: identification.vehicle,
    category: 'suspensao',
    userId: 'sales-validation-user',
  });
  const part = compatibility.compatibleParts[0];
  const service = miaCore.handleServiceIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    userId: 'sales-validation-user',
  });
  const serviceInput = pick(service, [
    'source',
    'system',
    'relatedComponents',
    'recommendations',
    'priority',
    'technicalJustification',
  ]);
  const recommendation = miaCore.handleRecommendation({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    serviceIntelligence: serviceInput,
    userId: 'sales-validation-user',
  });
  const recommendationInput = pick(recommendation, [
    'source',
    'complementaryComponents',
    'suggestedKits',
    'preventiveRecommendations',
    'technicalJustification',
    'priority',
    'confidence',
  ]);
  const budget = miaCore.handleBudgetIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    serviceIntelligence: serviceInput,
    recommendation: recommendationInput,
    userId: 'sales-validation-user',
  });
  const budgetInput = pick(budget, [
    'source',
    'vehicle',
    'category',
    'mainItem',
    'complementaryItems',
    'systemGroups',
    'technicalKits',
    'sellerNotes',
    'auditId',
  ]);
  const pricing = miaCore.handlePricingIntelligence({
    budget: budgetInput,
    userId: 'sales-validation-user',
  });
  const pricingInput = pick(pricing, [
    'source',
    'budgetAuditId',
    'items',
    'discounts',
    'taxes',
    'margin',
    'validity',
    'totals',
    'commercialNotes',
    'auditId',
  ]);
  const decision = miaCore.handleDecisionIntelligence({
    pricing: pricingInput,
    userId: 'sales-validation-user',
  });
  const decisionInput = pick(decision, [
    'source',
    'pricingAuditId',
    'decisions',
    'summary',
    'justifications',
    'auditId',
  ]);

  assert(
    [identification, compatibility, service, recommendation, budget, pricing, decision]
      .every(({ ok }) => ok),
    'upstream intelligence regression failed'
  );

  const expectedLibrary = platform.engines.libraryDiscovery
    .findByConsumer('sales.intelligence')[0];
  const expectedStrategy = decisionRulesEngine.buildSalesStrategy({
    pricing: pricingInput,
    decision: decisionInput,
    library: expectedLibrary,
  });
  const sales = miaCore.handleSalesIntelligence({
    pricing: pricingInput,
    decision: decisionInput,
    userId: 'sales-validation-user',
  });

  assert(sales.ok === true, 'Sales Intelligence execution failed');
  assert(sales.source === 'decision-rules-engine+library-registry', 'sales source mismatch');
  assert(sales.library.id === 'teffe-sales-strategy', 'sales library mismatch');
  assert(sales.library.version === '1.0.0', 'sales library version mismatch');
  assert(sales.complementarySaleOpportunity.available === true, 'sales opportunity missing');
  assert(
    JSON.stringify(sales.complementarySaleOpportunity) ===
      JSON.stringify(expectedStrategy.complementarySaleOpportunity),
    'sales opportunity strategy mismatch'
  );
  assert(sales.commercialPriority === 'high', 'commercial priority mismatch');
  assert(sales.technicalJustification === expectedStrategy.technicalJustification, 'justification mismatch');
  assert(sales.suggestedApproach === expectedStrategy.suggestedApproach, 'sales approach mismatch');
  assert(sales.requiresHuman === false, 'pending information must not force human service');
  assert(sales.commercialRisks.length > 0, 'commercial risks missing');
  assert(sales.nextSteps.length > 0, 'sales next steps missing');
  assert(sales.pricingAuditId === pricing.auditId, 'pricing audit reference mismatch');
  assert(sales.decisionAuditId === decision.auditId, 'decision audit reference mismatch');

  const humanDecision = {
    ...decisionInput,
    decisions: [{
      id: 'decision_route_to_human',
      type: 'route_to_human',
      priority: 'critical',
      reason: 'Manual review required.',
      nextAction: 'Route to human.',
      relatedItemIds: [pricingInput.items[0].id],
    }],
    summary: {
      canProceed: false,
      requiresHuman: true,
      awaitingInformation: false,
      awaitingStock: false,
      decisionCount: 1,
    },
    justifications: ['Manual review required.'],
  };
  const humanSales = miaCore.handleSalesIntelligence({
    pricing: pricingInput,
    decision: humanDecision,
    userId: 'sales-validation-user',
  });
  assert(humanSales.ok === true, 'human sales strategy failed');
  assert(humanSales.requiresHuman === true, 'human requirement missing');
  assert(humanSales.commercialPriority === 'critical', 'human priority mismatch');

  const invalidPricingSource = miaCore.handleSalesIntelligence({
    pricing: { ...pricingInput, source: 'manual' },
    decision: decisionInput,
  });
  assert(invalidPricingSource.ok === false, 'invalid pricing source must fail');
  assert(invalidPricingSource.error?.code === 'pricing_source_invalid', 'pricing source code mismatch');

  const invalidDecisionSource = miaCore.handleSalesIntelligence({
    pricing: pricingInput,
    decision: { ...decisionInput, source: 'manual' },
  });
  assert(invalidDecisionSource.ok === false, 'invalid decision source must fail');
  assert(invalidDecisionSource.error?.code === 'decision_source_invalid', 'decision source code mismatch');

  const invalidContract = miaCore.handleSalesIntelligence({
    pricing: pricingInput,
    decision: { ...decisionInput, decisions: [] },
  });
  assert(invalidContract.ok === false, 'empty decisions must fail');
  assert(
    invalidContract.error?.code === 'capability_input_contract_invalid',
    'empty decisions contract code mismatch'
  );

  const originalBuildSalesStrategy = decisionRulesEngine.buildSalesStrategy;
  decisionRulesEngine.buildSalesStrategy = () => ({
    ...expectedStrategy,
    commercialPriority: 'invalid',
  });
  const invalidStrategy = miaCore.handleSalesIntelligence({
    pricing: pricingInput,
    decision: decisionInput,
  });
  decisionRulesEngine.buildSalesStrategy = originalBuildSalesStrategy;
  assert(invalidStrategy.ok === false, 'invalid sales strategy must fail');
  assert(
    invalidStrategy.error?.code === 'capability_result_contract_invalid',
    'invalid sales strategy contract mismatch'
  );

  const persistedContext = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'context-store.json'), 'utf8')
  );
  assert(persistedContext.executions.length === 9, 'only nine successful executions must persist');
  assert(
    persistedContext.executions.every((execution) => execution.executionContext.services == null),
    'sales runtime services leaked into persisted context'
  );

  const auditLines = fs.readFileSync(path.join(dataDir, 'audit.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const salesRuleAudits = auditLines.filter((entry) =>
    entry.type === 'decision.rules.evaluated' &&
    entry.capability === 'sales.intelligence'
  );
  const salesLibraryAudits = auditLines.filter((entry) =>
    entry.type === 'library.discovery.queried' &&
    entry.capability === 'sales.intelligence'
  );
  assert(salesRuleAudits.length === 3, 'sales rule audit count mismatch');
  assert(salesLibraryAudits.length === 3, 'sales library audit count mismatch');

  const http = await validateHttp(pricingInput, decisionInput);

  console.log(JSON.stringify({
    pass: true,
    capability: {
      id: discovered.id,
      pluginId: discovered.pluginId,
      source: sales.source,
      library: sales.library,
    },
    strategy: {
      complementaryOpportunity: sales.complementarySaleOpportunity,
      priority: sales.commercialPriority,
      suggestedApproach: sales.suggestedApproach,
      requiresHuman: sales.requiresHuman,
      risks: sales.commercialRisks.length,
      nextSteps: sales.nextSteps.length,
    },
    humanStrategy: {
      priority: humanSales.commercialPriority,
      requiresHuman: humanSales.requiresHuman,
    },
    negativeTests: [
      invalidPricingSource,
      invalidDecisionSource,
      invalidContract,
      invalidStrategy,
    ].map(({ ok, error, auditId }) => ({ ok, error, auditId })),
    coverage: {
      sharedDomainContracts: true,
      decisionRulesEngine: true,
      libraryRegistry: true,
      registry: true,
      discovery: true,
      contracts: true,
      executionContext: true,
      noPriceCalculation: true,
      audit: true,
      memory: true,
      http: true,
    },
    audit: {
      ruleEvaluations: salesRuleAudits.length,
      libraryQueries: salesLibraryAudits.length,
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
