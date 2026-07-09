'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootPlatform } = require('../platform');
const { contracts } = require('../platform/domain/contracts');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-shared-contracts-'));
  const platform = bootPlatform({ dataDir });
  const { capabilityRegistry, contractValidator } = platform.engines;

  const identification = capabilityRegistry.get('vehicle-identification.manual');
  const compatibility = capabilityRegistry.get('vehicle.compatibility');
  const stock = capabilityRegistry.get('stock.availability');
  const service = capabilityRegistry.get('service.intelligence');
  const recommendation = capabilityRegistry.get('recommendation.engine');
  const budget = capabilityRegistry.get('budget.intelligence');
  const pricing = capabilityRegistry.get('pricing.intelligence');
  const decision = capabilityRegistry.get('decision.intelligence');

  assert(platform.capabilities.length === 8, 'expected eight registered capabilities');
  assert(identification.inputContract.properties.plate === contracts.rawPlate, 'raw plate contract not shared');
  assert(
    identification.resultContract.properties.vehicle.properties.brand ===
      contracts.vehicle.properties.brand,
    'identified vehicle fields are not shared'
  );
  assert(compatibility.inputContract.properties.vehicle === contracts.vehicle, 'compatibility vehicle not shared');
  assert(
    compatibility.resultContract.properties.compatibleParts.items === contracts.part,
    'compatibility part not shared'
  );
  assert(stock.inputContract.properties.vehicle === contracts.vehicle, 'stock vehicle not shared');
  assert(stock.inputContract.properties.part === contracts.part, 'stock part not shared');
  assert(service.inputContract.properties.category === contracts.category, 'service category not shared');
  assert(
    service.resultContract.properties.system === contracts.serviceIntelligence.properties.system,
    'Service Intelligence contract not shared'
  );
  assert(
    recommendation.inputContract.properties.serviceIntelligence === contracts.serviceIntelligence,
    'Recommendation Service Intelligence input not shared'
  );
  assert(
    recommendation.resultContract.properties.suggestedKits ===
      contracts.recommendation.properties.suggestedKits,
    'Recommendation result not shared'
  );
  assert(
    budget.inputContract.properties.serviceIntelligence === contracts.serviceIntelligence,
    'Budget Service Intelligence input not shared'
  );
  assert(
    budget.inputContract.properties.recommendation === contracts.recommendation,
    'Budget Recommendation input not shared'
  );
  assert(
    budget.resultContract.properties.mainItem === contracts.budgetIntelligence.properties.mainItem,
    'Budget result not shared'
  );
  assert(
    pricing.inputContract.properties.budget === contracts.budgetIntelligenceResult,
    'Pricing Budget input not shared'
  );
  assert(
    pricing.resultContract === contracts.pricingIntelligence,
    'Pricing result not shared'
  );
  assert(
    decision.inputContract.properties.pricing === contracts.pricingIntelligence,
    'Decision Pricing input not shared'
  );
  assert(
    decision.resultContract === contracts.decisionIntelligence,
    'Decision result not shared'
  );
  assert(
    decision.requirements?.includes('decisionRules'),
    'Decision Rules runtime requirement missing'
  );

  const vehicle = {
    plate: 'ABC1D23',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
  };
  const part = {
    name: 'Amortecedor dianteiro',
    manufacturer: 'Cofap',
    internalCode: 'TFF-SUS-001',
    technicalNotes: 'Mock notes',
  };
  const intelligence = {
    source: 'domain-knowledge-engine',
    system: {
      id: 'suspensao',
      name: 'Suspensao',
      description: 'Mock description',
    },
    relatedComponents: [],
    recommendations: [],
    priority: 'high',
    technicalJustification: 'Mock justification',
  };
  const recommendationValue = {
    source: 'service-intelligence+domain-knowledge-engine',
    complementaryComponents: [],
    suggestedKits: [],
    preventiveRecommendations: [],
    technicalJustification: 'Mock recommendation justification',
    priority: 'high',
    confidence: 'low',
  };
  const budgetValue = {
    mainItem: {
      type: 'main',
      name: part.name,
      manufacturer: part.manufacturer,
      internalCode: part.internalCode,
      priority: 'high',
      technicalJustification: 'Mock justification',
    },
    complementaryItems: [],
    systemGroups: [{
      system: { id: 'suspensao', name: 'Suspensao' },
      items: [part.name],
    }],
    technicalKits: [],
    sellerNotes: ['Mock seller note'],
  };

  assert(contractValidator.validate(vehicle, contracts.vehicle).valid, 'vehicle contract rejected valid value');
  assert(contractValidator.validate(part, contracts.part).valid, 'part contract rejected valid value');
  assert(
    contractValidator.validate('suspensao', contracts.category).valid,
    'category contract rejected valid value'
  );
  assert(
    contractValidator.validate(intelligence, contracts.serviceIntelligence).valid,
    'Service Intelligence contract rejected valid value'
  );
  assert(
    contractValidator.validate(recommendationValue, contracts.recommendation).valid,
    'Recommendation contract rejected valid value'
  );
  assert(
    contractValidator.validate(budgetValue, contracts.budgetIntelligence).valid,
    'Budget contract rejected valid value'
  );

  assert(
    !contractValidator.validate({ ...vehicle, year: '2022' }, contracts.vehicle).valid,
    'vehicle contract accepted invalid year'
  );
  assert(
    !contractValidator.validate({ ...part, internalCode: '' }, contracts.part).valid,
    'part contract accepted empty internal code'
  );
  assert(
    !contractValidator.validate({ ...intelligence, system: null }, contracts.serviceIntelligence).valid,
    'Service Intelligence contract accepted invalid system'
  );
  assert(
    !contractValidator.validate({ ...recommendationValue, confidence: null }, contracts.recommendation).valid,
    'Recommendation contract accepted invalid confidence'
  );
  assert(
    !contractValidator.validate({ ...budgetValue, systemGroups: [] }, contracts.budgetIntelligence).valid,
    'Budget contract accepted empty system groups'
  );

  assert(Object.isFrozen(contracts), 'contracts collection must be frozen');
  assert(Object.isFrozen(contracts.vehicle.properties), 'nested vehicle contract must be frozen');
  try {
    contracts.vehicle.required.push('invalidMutation');
  } catch (_error) {
    // Expected in strict mode.
  }
  assert(
    !contracts.vehicle.required.includes('invalidMutation'),
    'shared contract was mutated'
  );

  const pluginsDir = path.join(__dirname, '..', 'platform', 'plugins');
  const pluginFiles = fs.readdirSync(pluginsDir)
    .map((folder) => path.join(pluginsDir, folder, 'index.js'));
  const duplicatePattern =
    /const\s+(vehicleContract|partContract|serviceIntelligenceContract|recommendationContract|budgetItemContract)\s*=/;

  for (const pluginFile of pluginFiles) {
    const source = fs.readFileSync(pluginFile, 'utf8');
    assert(source.includes("domain/contracts"), `plugin is not using shared contracts: ${pluginFile}`);
    assert(!duplicatePattern.test(source), `duplicate domain contract remains: ${pluginFile}`);
  }

  console.log(JSON.stringify({
    pass: true,
    module: 'Shared Domain Contracts',
    contracts: [
      'vehicle',
      'part',
      'category',
      'serviceIntelligence',
      'recommendation',
      'budgetIntelligence',
      'pricingIntelligence',
      'decisionIntelligence',
    ],
    migratedCapabilities: platform.capabilities.map(({ id }) => id),
    validation: {
      positive: 6,
      negative: 5,
      emptyCollectionsCompatible: true,
      deeplyFrozen: true,
      duplicateDeclarations: 0,
    },
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ pass: false, error: error.message }, null, 2));
  process.exit(1);
}
