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

async function validateHttp(vehicle, part, intelligence, recommendation) {
  const port = 36000 + (process.pid % 1000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const payload = {
      vehicle,
      part,
      category: 'suspensao',
      serviceIntelligence: intelligence,
      recommendation,
      userId: 'http-budget-user',
    };
    const success = await fetch(`http://127.0.0.1:${port}/capabilities/budget`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const successBody = await success.json();
    assert(success.status === 200, `expected HTTP 200, got ${success.status}`);
    assert(successBody.ok === true, 'HTTP Budget Intelligence success missing');
    assert(successBody.mainItem?.internalCode === part.internalCode, 'HTTP main item mismatch');

    const failure = await fetch(`http://127.0.0.1:${port}/capabilities/budget`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        recommendation: { ...recommendation, source: 'manual' },
      }),
    });
    const failureBody = await failure.json();
    assert(failure.status === 400, `expected HTTP 400, got ${failure.status}`);
    assert(failureBody.error?.code === 'recommendation_source_invalid', 'HTTP budget error mismatch');

    return {
      endpoint: '/capabilities/budget',
      successStatus: success.status,
      failureStatus: failure.status,
    };
  } finally {
    child.kill();
  }
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-budget-'));
  const platform = bootPlatform({ dataDir });
  const {
    miaCore,
    capabilityRegistry,
    capabilityDiscovery,
    domainKnowledgeEngine,
  } = platform.engines;

  assert(platform.status === 'ok', 'platform boot failed');
  assert(platform.plugins.includes('budget-intelligence'), 'Budget Intelligence plugin not loaded');
  assert(capabilityRegistry.has('budget.intelligence'), 'Budget Intelligence not registered');

  const discovered = capabilityDiscovery.findById('budget.intelligence');
  assert(discovered?.pluginId === 'budget-intelligence', 'Budget Intelligence mapping missing');
  assert(discovered?.requirements?.includes('domainKnowledge'), 'DKE runtime requirement missing');
  assert(
    discovered?.inputContract?.required?.includes('recommendation'),
    'Recommendation Engine input contract missing'
  );
  assert(discovered?.resultContract?.properties?.sellerNotes, 'seller notes result contract missing');

  const identification = miaCore.handleManualVehicleIdentification({
    plate: 'ABC-1D23',
    userId: 'budget-validation-user',
  });
  assert(identification.ok === true, 'vehicle identification failed');

  const compatibility = miaCore.handleVehicleCompatibility({
    vehicle: identification.vehicle,
    category: 'suspensao',
    userId: 'budget-validation-user',
  });
  assert(compatibility.ok === true, 'vehicle compatibility failed');
  const part = compatibility.compatibleParts[0];

  const service = miaCore.handleServiceIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    userId: 'budget-validation-user',
  });
  assert(service.ok === true, 'Service Intelligence regression failed');
  const intelligence = serviceResult(service);

  const recommendation = miaCore.handleRecommendation({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    serviceIntelligence: intelligence,
    userId: 'budget-validation-user',
  });
  assert(recommendation.ok === true, 'Recommendation Engine regression failed');
  const recommendationInput = recommendationResult(recommendation);

  const expected = domainKnowledgeEngine.getBudgetStructure({
    category: 'suspensao',
    part,
    serviceIntelligence: intelligence,
    recommendation: recommendationInput,
  });
  const budget = miaCore.handleBudgetIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'Suspens\u00e3o',
    serviceIntelligence: intelligence,
    recommendation: recommendationInput,
    userId: 'budget-validation-user',
  });

  assert(budget.ok === true, 'Budget Intelligence execution failed');
  assert(budget.category === 'suspensao', 'budget category was not normalized');
  assert(
    budget.source === 'service-intelligence+recommendation-engine+domain-knowledge-engine',
    'budget source mismatch'
  );
  assert(JSON.stringify(budget.mainItem) === JSON.stringify(expected.mainItem), 'main item mismatch');
  assert(
    JSON.stringify(budget.complementaryItems) === JSON.stringify(expected.complementaryItems),
    'complementary items mismatch'
  );
  assert(JSON.stringify(budget.systemGroups) === JSON.stringify(expected.systemGroups), 'grouping mismatch');
  assert(JSON.stringify(budget.technicalKits) === JSON.stringify(expected.technicalKits), 'kits mismatch');
  assert(JSON.stringify(budget.sellerNotes) === JSON.stringify(expected.sellerNotes), 'seller notes mismatch');
  assert(budget.mainItem.priority === 'high', 'main item priority missing');
  assert(budget.complementaryItems.every((item) => item.priority), 'item priority missing');
  assert(budget.complementaryItems.every((item) => item.technicalJustification), 'item justification missing');
  assert(!JSON.stringify(budget).toLowerCase().includes('"price"'), 'budget must not contain prices');
  assert(budget.auditId, 'budget auditId missing');

  const emptyRecommendation = {
    ...recommendationInput,
    complementaryComponents: [],
    suggestedKits: [],
    preventiveRecommendations: [],
    confidence: 'low',
  };
  const budgetWithoutRecommendations = miaCore.handleBudgetIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    serviceIntelligence: intelligence,
    recommendation: emptyRecommendation,
    userId: 'budget-validation-user',
  });
  assert(budgetWithoutRecommendations.ok === true, 'budget without recommendations must succeed');
  assert(budgetWithoutRecommendations.complementaryItems.length === 0, 'complementary items must be empty');
  assert(budgetWithoutRecommendations.technicalKits.length === 0, 'technical kits must be empty');
  assert(budgetWithoutRecommendations.systemGroups[0].items.length === 1, 'group must contain main item');
  assert(budgetWithoutRecommendations.sellerNotes.length === 1, 'seller note fallback missing');

  const invalidSource = miaCore.handleBudgetIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    serviceIntelligence: intelligence,
    recommendation: { ...recommendationInput, source: 'manual' },
  });
  assert(invalidSource.ok === false, 'invalid recommendation source must fail');
  assert(invalidSource.error?.code === 'recommendation_source_invalid', 'source error code mismatch');

  const knowledgeMismatch = miaCore.handleBudgetIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'freios',
    serviceIntelligence: intelligence,
    recommendation: recommendationInput,
  });
  assert(knowledgeMismatch.ok === false, 'budget knowledge mismatch must fail');
  assert(knowledgeMismatch.error?.code === 'budget_knowledge_mismatch', 'knowledge mismatch code mismatch');

  const invalidContract = miaCore.handleBudgetIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    serviceIntelligence: intelligence,
    recommendation: {
      source: 'service-intelligence+domain-knowledge-engine',
      complementaryComponents: [],
    },
  });
  assert(invalidContract.ok === false, 'invalid recommendation contract must fail');
  assert(
    invalidContract.error?.code === 'capability_input_contract_invalid',
    'invalid recommendation contract code mismatch'
  );

  const budgetPlugin = platform.engines.pluginEngine.plugins.get('budget-intelligence');
  const originalExecute = budgetPlugin.execute;
  budgetPlugin.execute = (input) => ({
    source: 'service-intelligence+recommendation-engine+domain-knowledge-engine',
    vehicle: input.vehicle,
    category: input.category,
  });
  const invalidResult = miaCore.handleBudgetIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    serviceIntelligence: intelligence,
    recommendation: recommendationInput,
  });
  budgetPlugin.execute = originalExecute;
  assert(invalidResult.ok === false, 'invalid budget result must fail');
  assert(
    invalidResult.error?.code === 'capability_result_contract_invalid',
    'invalid budget result contract mismatch'
  );

  const persistedContext = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'context-store.json'), 'utf8')
  );
  assert(persistedContext.executions.length === 6, 'only six successful executions must persist');
  assert(
    persistedContext.executions.every((execution) => execution.executionContext.services == null),
    'runtime services leaked into persisted context'
  );

  const auditLines = fs.readFileSync(path.join(dataDir, 'audit.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const dkeAudits = auditLines.filter((entry) =>
    entry.type === 'domain.knowledge.queried' &&
    entry.capability === 'budget.intelligence'
  );
  assert(dkeAudits.length === 3, 'Budget Intelligence DKE audit count mismatch');
  assert(dkeAudits.every((entry) => entry.capabilityAuditId), 'DKE capability audit link missing');

  const http = await validateHttp(
    identification.vehicle,
    part,
    intelligence,
    recommendationInput
  );

  console.log(JSON.stringify({
    pass: true,
    capability: {
      id: discovered.id,
      pluginId: discovered.pluginId,
      source: budget.source,
    },
    budget: {
      mainItem: budget.mainItem,
      complementaryItems: budget.complementaryItems.length,
      systemGroups: budget.systemGroups.length,
      technicalKits: budget.technicalKits.length,
      sellerNotes: budget.sellerNotes,
      containsPrices: false,
      auditId: budget.auditId,
    },
    withoutRecommendations: {
      ok: budgetWithoutRecommendations.ok,
      complementaryItems: budgetWithoutRecommendations.complementaryItems.length,
      technicalKits: budgetWithoutRecommendations.technicalKits.length,
    },
    negativeTests: [invalidSource, knowledgeMismatch, invalidContract, invalidResult]
      .map(({ ok, error, auditId }) => ({ ok, error, auditId })),
    coverage: {
      registry: true,
      discovery: true,
      contracts: true,
      executionContext: true,
      serviceIntelligence: true,
      recommendationEngine: true,
      domainKnowledgeEngine: true,
      noRecommendations: true,
      noPricing: true,
      audit: true,
      memory: true,
      http: true,
    },
    memory: {
      executions: persistedContext.executions.length,
    },
    audit: {
      budgetDkeQueries: dkeAudits.length,
    },
    http,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ pass: false, error: error.message }, null, 2));
  process.exit(1);
});
