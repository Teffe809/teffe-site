const { DecisionRulesEngine } = require('../platform/engines/decision-rules-engine');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function item(id, type, status = 'pending', values = {}) {
  return {
    id,
    type,
    pricing: {
      status,
      quantity: values.quantity ?? null,
      unitPrice: values.unitPrice ?? null,
      subtotal: values.subtotal ?? null,
      currency: values.currency ?? null,
    },
  };
}

function pricing(items, total = null) {
  return {
    items,
    totals: { total },
  };
}

function types(result) {
  return result.decisions.map(({ type }) => type);
}

function main() {
  const engine = new DecisionRulesEngine();

  const pending = engine.evaluate(pricing([
    item('main', 'main'),
    item('complementary_1', 'complementary'),
    item('complementary_2', 'complementary'),
  ]));
  assert(types(pending).includes('suggest_complementary_sale'), 'complementary sale rule failed');
  assert(types(pending).includes('suggest_kit'), 'kit rule failed');
  assert(types(pending).includes('request_more_information'), 'information rule failed');
  assert(pending.summary.canProceed === false, 'pending context must not proceed');

  const resolved = engine.evaluate(pricing([
    item('main', 'main', 'resolved', {
      quantity: 1,
      unitPrice: 100,
      subtotal: 100,
      currency: 'BRL',
    }),
  ], 100));
  assert(types(resolved).includes('proceed_to_budget'), 'proceed rule failed');
  assert(resolved.summary.canProceed === true, 'resolved context must proceed');

  const intervention = engine.evaluate(pricing([
    item('stock', 'main', 'awaiting_stock'),
    item('manual', 'complementary', 'manual_review'),
  ]));
  assert(types(intervention).includes('await_stock'), 'stock rule failed');
  assert(types(intervention).includes('route_to_human'), 'human route rule failed');
  assert(intervention.summary.awaitingStock === true, 'stock summary failed');
  assert(intervention.summary.requiresHuman === true, 'human summary failed');

  const noComplementary = engine.evaluate(pricing([
    item('main', 'main'),
  ]));
  assert(
    !types(noComplementary).includes('suggest_complementary_sale'),
    'complementary rule fired without complementary items'
  );
  assert(!types(noComplementary).includes('suggest_kit'), 'kit rule fired without complementary items');
  assert(types(noComplementary).includes('request_more_information'), 'negative rule fallback missing');

  let invalidContextRejected = false;
  try {
    engine.evaluate({});
  } catch (error) {
    invalidContextRejected = error.message.includes('valid pricing context');
  }
  assert(invalidContextRejected, 'invalid pricing context was not rejected');

  for (const result of [pending, resolved, intervention, noComplementary]) {
    assert(result.decisions.length === result.justifications.length, 'justification count mismatch');
    assert(result.summary.decisionCount === result.decisions.length, 'decision count mismatch');
  }

  console.log(JSON.stringify({
    pass: true,
    engine: 'Decision Rules Engine',
    rules: {
      pending: types(pending),
      resolved: types(resolved),
      intervention: types(intervention),
      noComplementary: types(noComplementary),
    },
    validation: {
      positiveScenarios: 3,
      negativeScenarios: 2,
      justificationsAuditReady: true,
    },
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ pass: false, error: error.message }, null, 2));
  process.exit(1);
}
