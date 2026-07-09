const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { bootPlatform } = require('../platform');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

async function validateHttp(vehicle, part, intelligence) {
  const port = 35000 + (process.pid % 1000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const success = await fetch(`http://127.0.0.1:${port}/capabilities/recommendation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        vehicle,
        part,
        category: 'suspensao',
        serviceIntelligence: intelligence,
        userId: 'http-recommendation-user',
      }),
    });
    const successBody = await success.json();
    assert(success.status === 200, `expected HTTP 200, got ${success.status}`);
    assert(successBody.ok === true, 'HTTP Recommendation Engine success missing');
    assert(successBody.source === 'service-intelligence+domain-knowledge-engine', 'HTTP source mismatch');

    const failure = await fetch(`http://127.0.0.1:${port}/capabilities/recommendation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        vehicle,
        part,
        category: 'suspensao',
        serviceIntelligence: { ...intelligence, source: 'manual' },
      }),
    });
    const failureBody = await failure.json();
    assert(failure.status === 400, `expected HTTP 400, got ${failure.status}`);
    assert(
      failureBody.error?.code === 'service_intelligence_source_invalid',
      'HTTP recommendation error mismatch'
    );

    return {
      endpoint: '/capabilities/recommendation',
      successStatus: success.status,
      failureStatus: failure.status,
    };
  } finally {
    child.kill();
  }
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-recommendation-'));
  const platform = bootPlatform({ dataDir });
  const {
    miaCore,
    capabilityRegistry,
    capabilityDiscovery,
    domainKnowledgeEngine,
  } = platform.engines;

  assert(platform.status === 'ok', 'platform boot failed');
  assert(platform.plugins.includes('recommendation-engine'), 'Recommendation Engine plugin not loaded');
  assert(capabilityRegistry.has('recommendation.engine'), 'Recommendation Engine not registered');

  const discovered = capabilityDiscovery.findById('recommendation.engine');
  assert(discovered?.pluginId === 'recommendation-engine', 'Recommendation Engine mapping missing');
  assert(discovered?.requirements?.includes('domainKnowledge'), 'DKE runtime requirement missing');
  assert(
    discovered?.inputContract?.required?.includes('serviceIntelligence'),
    'Service Intelligence input contract missing'
  );
  assert(discovered?.resultContract?.properties?.confidence, 'confidence result contract missing');

  const identification = miaCore.handleManualVehicleIdentification({
    plate: 'ABC-1D23',
    userId: 'recommendation-validation-user',
  });
  assert(identification.ok === true, 'vehicle identification failed');

  const compatibility = miaCore.handleVehicleCompatibility({
    vehicle: identification.vehicle,
    category: 'suspensao',
    userId: 'recommendation-validation-user',
  });
  assert(compatibility.ok === true, 'vehicle compatibility failed');
  const part = compatibility.compatibleParts[0];

  const service = miaCore.handleServiceIntelligence({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    userId: 'recommendation-validation-user',
  });
  assert(service.ok === true, 'Service Intelligence regression failed');
  const intelligence = serviceResult(service);

  const expected = domainKnowledgeEngine.getRecommendations({
    category: 'suspensao',
    component: part.name,
    serviceIntelligence: intelligence,
  });
  const recommendation = miaCore.handleRecommendation({
    vehicle: identification.vehicle,
    part,
    category: 'Suspens\u00e3o',
    serviceIntelligence: intelligence,
    userId: 'recommendation-validation-user',
  });

  assert(recommendation.ok === true, 'Recommendation Engine execution failed');
  assert(recommendation.category === 'suspensao', 'recommendation category was not normalized');
  assert(recommendation.source === 'service-intelligence+domain-knowledge-engine', 'source mismatch');
  assert(
    JSON.stringify(recommendation.complementaryComponents) ===
      JSON.stringify(expected.complementaryComponents),
    'DKE complementary components mismatch'
  );
  assert(JSON.stringify(recommendation.suggestedKits) === JSON.stringify(expected.suggestedKits), 'kits mismatch');
  assert(
    JSON.stringify(recommendation.preventiveRecommendations) ===
      JSON.stringify(expected.preventiveRecommendations),
    'preventive recommendations mismatch'
  );
  assert(recommendation.technicalJustification === expected.technicalJustification, 'justification mismatch');
  assert(recommendation.priority === expected.priority, 'priority mismatch');
  assert(recommendation.confidence === expected.confidence, 'confidence mismatch');
  assert(recommendation.auditId, 'recommendation auditId missing');

  const noRelatedIntelligence = {
    ...intelligence,
    relatedComponents: [],
  };
  const noRelated = miaCore.handleRecommendation({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    serviceIntelligence: noRelatedIntelligence,
    userId: 'recommendation-validation-user',
  });
  assert(noRelated.ok === true, 'recommendation without related components must succeed');
  assert(noRelated.complementaryComponents.length === 0, 'complementary components must be empty');
  assert(noRelated.suggestedKits.length === 0, 'kits must be empty without related components');
  assert(noRelated.confidence === 'low', 'confidence must be low without related components');
  assert(noRelated.preventiveRecommendations.length > 0, 'preventive recommendations must remain available');

  const invalidSource = miaCore.handleRecommendation({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    serviceIntelligence: { ...intelligence, source: 'manual' },
  });
  assert(invalidSource.ok === false, 'invalid Service Intelligence source must fail');
  assert(
    invalidSource.error?.code === 'service_intelligence_source_invalid',
    'invalid Service Intelligence source code mismatch'
  );

  const knowledgeMismatch = miaCore.handleRecommendation({
    vehicle: identification.vehicle,
    part,
    category: 'freios',
    serviceIntelligence: intelligence,
  });
  assert(knowledgeMismatch.ok === false, 'domain knowledge mismatch must fail');
  assert(
    knowledgeMismatch.error?.code === 'recommendation_knowledge_mismatch',
    'domain knowledge mismatch code mismatch'
  );

  const invalidContract = miaCore.handleRecommendation({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    serviceIntelligence: {
      source: 'domain-knowledge-engine',
      relatedComponents: [],
    },
  });
  assert(invalidContract.ok === false, 'invalid Service Intelligence contract must fail');
  assert(
    invalidContract.error?.code === 'capability_input_contract_invalid',
    'invalid Service Intelligence contract code mismatch'
  );

  const recommendationPlugin = platform.engines.pluginEngine.plugins.get('recommendation-engine');
  const originalExecute = recommendationPlugin.execute;
  recommendationPlugin.execute = (input) => ({
    source: 'service-intelligence+domain-knowledge-engine',
    vehicle: input.vehicle,
    part: input.part,
    category: input.category,
  });
  const invalidResult = miaCore.handleRecommendation({
    vehicle: identification.vehicle,
    part,
    category: 'suspensao',
    serviceIntelligence: intelligence,
  });
  recommendationPlugin.execute = originalExecute;
  assert(invalidResult.ok === false, 'invalid recommendation result must fail');
  assert(
    invalidResult.error?.code === 'capability_result_contract_invalid',
    'invalid recommendation result contract mismatch'
  );

  const persistedContext = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'context-store.json'), 'utf8')
  );
  assert(persistedContext.executions.length === 5, 'only five successful executions must persist');
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
    entry.capability === 'recommendation.engine'
  );
  assert(dkeAudits.length === 3, 'Recommendation Engine DKE audit count mismatch');
  assert(dkeAudits.every((entry) => entry.capabilityAuditId), 'DKE capability audit link missing');

  const http = await validateHttp(identification.vehicle, part, intelligence);

  console.log(JSON.stringify({
    pass: true,
    capability: {
      id: discovered.id,
      pluginId: discovered.pluginId,
      source: recommendation.source,
    },
    result: {
      complementaryComponents: recommendation.complementaryComponents.length,
      suggestedKits: recommendation.suggestedKits,
      preventiveRecommendations: recommendation.preventiveRecommendations,
      priority: recommendation.priority,
      confidence: recommendation.confidence,
      auditId: recommendation.auditId,
    },
    noRelatedComponents: {
      ok: noRelated.ok,
      suggestedKits: noRelated.suggestedKits.length,
      confidence: noRelated.confidence,
    },
    negativeTests: [invalidSource, knowledgeMismatch, invalidContract, invalidResult]
      .map(({ ok, error, auditId }) => ({ ok, error, auditId })),
    coverage: {
      registry: true,
      discovery: true,
      contracts: true,
      executionContext: true,
      serviceIntelligence: true,
      domainKnowledgeEngine: true,
      noRelatedComponents: true,
      audit: true,
      memory: true,
      http: true,
    },
    memory: {
      executions: persistedContext.executions.length,
    },
    audit: {
      recommendationDkeQueries: dkeAudits.length,
    },
    http,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ pass: false, error: error.message }, null, 2));
  process.exit(1);
});
