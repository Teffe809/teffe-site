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

function pricingResult(response) {
  return pick(response, [
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

async function validateHttp(pricing) {
  const port = 38000 + (process.pid % 1000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      TEFFE_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-http-decision-')),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const success = await fetch(`http://127.0.0.1:${port}/capabilities/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pricing, userId: 'http-decision-user' }),
    });
    const successBody = await success.json();
    assert(success.status === 200, `expected HTTP 200, got ${success.status}`);
    assert(successBody.ok === true, 'HTTP Decision Intelligence success missing');
    assert(successBody.decisions.length > 0, 'HTTP decisions missing');

    const failure = await fetch(`http://127.0.0.1:${port}/capabilities/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pricing: { ...pricing, source: 'manual' } }),
    });
    const failureBody = await failure.json();
    assert(failure.status === 400, `expected HTTP 400, got ${failure.status}`);
    assert(failureBody.error?.code === 'pricing_source_invalid', 'HTTP decision error mismatch');

    return {
      endpoint: '/capabilities/decision',
      successStatus: success.status,
      failureStatus: failure.status,
    };
  } finally {
    child.kill();
  }
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-decision-'));
  const platform = bootPlatform({ dataDir });
  const { miaCore, capabilityRegistry, capabilityDiscovery } = platform.engines;

  assert(platform.status === 'ok', 'platform boot failed');
  assert(platform.plugins.includes('decision-intelligence'), 'Decision Intelligence plugin not loaded');
  assert(capabilityRegistry.has('decision.intelligence'), 'Decision Intelligence not registered');

  const discovered = capabilityDiscovery.findById('decision.intelligence');
  assert(discovered?.pluginId === 'decision-intelligence', 'Decision Intelligence mapping missing');
  assert(discovered?.inputContract?.required?.includes('pricing'), 'pricing input contract missing');
  assert(discovered?.resultContract?.properties?.decisions, 'decisions result contract missing');
  assert(!discovered?.requirements?.includes('domainKnowledge'), 'Decision must not require DKE');

  const identification = miaCore.handleManualVehicleIdentification({
    plate: 'ABC-1D23',
    userId: 'decision-validation-user',
  });
  const compatibility = miaCore.handleVehicleCompatibility({
    vehicle: identification.vehicle,
    category: 'suspensao',
    userId: 'decision-validation-user',
  });
  const part = compatibility.compatibleParts[0];
  const service = miaCore.handleServiceIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    userId: 'decision-validation-user',
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
    userId: 'decision-validation-user',
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
    userId: 'decision-validation-user',
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
    userId: 'decision-validation-user',
  });

  assert(identification.ok && compatibility.ok && service.ok, 'technical flow regression failed');
  assert(recommendation.ok && budget.ok && pricing.ok, 'commercial flow regression failed');
  const pricingInput = pricingResult(pricing);

  const decision = miaCore.handleDecisionIntelligence({
    pricing: pricingInput,
    userId: 'decision-validation-user',
  });
  assert(decision.ok === true, 'Decision Intelligence execution failed');
  const decisionTypes = decision.decisions.map(({ type }) => type);
  assert(decisionTypes.includes('suggest_complementary_sale'), 'complementary sale decision missing');
  assert(decisionTypes.includes('suggest_kit'), 'kit decision missing');
  assert(decisionTypes.includes('request_more_information'), 'information request decision missing');
  assert(decision.summary.canProceed === false, 'pending pricing must not proceed');
  assert(decision.summary.awaitingInformation === true, 'awaiting information summary mismatch');
  assert(decision.summary.decisionCount === decision.decisions.length, 'decision count mismatch');
  assert(decision.justifications.length === decision.decisions.length, 'justification count mismatch');
  assert(decision.pricingAuditId === pricing.auditId, 'pricing audit reference mismatch');
  assert(decision.auditId, 'decision auditId missing');

  const resolvedPricing = {
    ...pricingInput,
    items: pricingInput.items.map((item) => ({
      ...item,
      pricing: {
        status: 'resolved',
        quantity: 1,
        unitPrice: 100,
        subtotal: 100,
        currency: 'BRL',
      },
    })),
    totals: {
      status: 'resolved',
      subtotal: pricingInput.items.length * 100,
      discounts: 0,
      taxes: 0,
      total: pricingInput.items.length * 100,
      currency: 'BRL',
    },
  };
  const proceedDecision = miaCore.handleDecisionIntelligence({
    pricing: resolvedPricing,
    userId: 'decision-validation-user',
  });
  assert(proceedDecision.ok === true, 'resolved pricing decision failed');
  assert(
    proceedDecision.decisions.some(({ type }) => type === 'proceed_to_budget'),
    'proceed decision missing'
  );
  assert(proceedDecision.summary.canProceed === true, 'resolved pricing must proceed');
  assert(proceedDecision.summary.awaitingInformation === false, 'resolved pricing awaits information');

  const interventionPricing = {
    ...pricingInput,
    items: pricingInput.items.map((item, index) => ({
      ...item,
      pricing: {
        ...item.pricing,
        status: index === 0 ? 'awaiting_stock' : 'manual_review',
      },
    })),
  };
  const interventionDecision = miaCore.handleDecisionIntelligence({
    pricing: interventionPricing,
    userId: 'decision-validation-user',
  });
  assert(interventionDecision.ok === true, 'intervention decision failed');
  assert(
    interventionDecision.decisions.some(({ type }) => type === 'await_stock'),
    'await stock decision missing'
  );
  assert(
    interventionDecision.decisions.some(({ type }) => type === 'route_to_human'),
    'human route decision missing'
  );
  assert(interventionDecision.summary.awaitingStock === true, 'awaiting stock summary mismatch');
  assert(interventionDecision.summary.requiresHuman === true, 'human review summary mismatch');

  const invalidSource = miaCore.handleDecisionIntelligence({
    pricing: { ...pricingInput, source: 'manual' },
  });
  assert(invalidSource.ok === false, 'invalid pricing source must fail');
  assert(invalidSource.error?.code === 'pricing_source_invalid', 'pricing source code mismatch');

  const invalidContract = miaCore.handleDecisionIntelligence({
    pricing: { ...pricingInput, items: [] },
  });
  assert(invalidContract.ok === false, 'empty pricing items must fail');
  assert(
    invalidContract.error?.code === 'capability_input_contract_invalid',
    'invalid pricing contract code mismatch'
  );

  const decisionPlugin = platform.engines.pluginEngine.plugins.get('decision-intelligence');
  const originalExecute = decisionPlugin.execute;
  decisionPlugin.execute = () => ({
    source: 'pricing-intelligence',
    pricingAuditId: null,
    decisions: [{
      id: 'invalid_decision',
      type: 'unknown_decision',
      priority: 'high',
      reason: 'Invalid decision for contract validation.',
      nextAction: 'None',
      relatedItemIds: [],
    }],
    summary: {
      canProceed: false,
      requiresHuman: false,
      awaitingInformation: false,
      awaitingStock: false,
      decisionCount: 1,
    },
    justifications: ['Invalid decision for contract validation.'],
  });
  const invalidDecision = miaCore.handleDecisionIntelligence({ pricing: pricingInput });
  decisionPlugin.execute = originalExecute;
  assert(invalidDecision.ok === false, 'invalid decision type must fail');
  assert(
    invalidDecision.error?.code === 'capability_result_contract_invalid',
    'invalid decision contract code mismatch'
  );
  assert(
    invalidDecision.error.details.violations.some(({ rule }) => rule === 'enum'),
    'invalid decision enum violation missing'
  );

  const persistedContext = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'context-store.json'), 'utf8')
  );
  assert(persistedContext.executions.length === 9, 'only nine successful executions must persist');
  assert(
    persistedContext.executions.every((execution) => execution.executionContext.services == null),
    'Decision Rules service leaked into persisted context'
  );

  const auditLines = fs.readFileSync(path.join(dataDir, 'audit.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const ruleAudits = auditLines.filter((entry) =>
    entry.type === 'decision.rules.evaluated' &&
    entry.capability === 'decision.intelligence'
  );
  assert(ruleAudits.length === 3, 'Decision Rules audit count mismatch');
  assert(ruleAudits.every((entry) => entry.capabilityAuditId), 'Decision Rules audit link missing');

  const http = await validateHttp(pricingInput);

  console.log(JSON.stringify({
    pass: true,
    capability: {
      id: discovered.id,
      pluginId: discovered.pluginId,
      source: decision.source,
    },
    decisions: {
      pending: decisionTypes,
      canProceed: decision.summary.canProceed,
      resolved: proceedDecision.decisions.map(({ type }) => type),
      resolvedCanProceed: proceedDecision.summary.canProceed,
      intervention: interventionDecision.decisions.map(({ type }) => type),
      requiresHuman: interventionDecision.summary.requiresHuman,
      awaitingStock: interventionDecision.summary.awaitingStock,
      justifications: decision.justifications.length,
      pricingAuditId: decision.pricingAuditId,
      auditId: decision.auditId,
    },
    negativeTests: [invalidSource, invalidContract, invalidDecision]
      .map(({ ok, error, auditId }) => ({ ok, error, auditId })),
    coverage: {
      sharedDomainContracts: true,
      registry: true,
      discovery: true,
      contracts: true,
      enumValidation: true,
      executionContext: true,
      pricingIntelligence: true,
      pendingDecisions: true,
      proceedDecision: true,
      stockAndHumanDecisions: true,
      decisionRulesEngine: true,
      audit: true,
      memory: true,
      http: true,
    },
    memory: {
      executions: persistedContext.executions.length,
    },
    audit: {
      ruleEvaluations: ruleAudits.length,
    },
    http,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ pass: false, error: error.message }, null, 2));
  process.exit(1);
});
