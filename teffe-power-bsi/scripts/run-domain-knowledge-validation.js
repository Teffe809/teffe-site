const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootPlatform } = require('../platform');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-dke-validation-'));
  const platform = bootPlatform({ dataDir });
  const dke = platform.engines.domainKnowledgeEngine;
  const workflow = platform.engines.workflowEngine;

  assert(platform.status === 'ok', 'platform boot failed');
  assert(dke, 'Domain Knowledge Engine missing');
  assert(platform.capabilities.length >= 3, 'capability registry changed unexpectedly');
  assert(platform.plugins.length >= 3, 'plugin engine changed unexpectedly');

  const systems = dke.listSystems();
  const expectedSystems = [
    'suspensao',
    'freios',
    'motor',
    'arrefecimento',
    'transmissao',
    'filtros',
  ];
  assert(systems.length === expectedSystems.length, 'domain system count mismatch');

  for (const id of expectedSystems) {
    const system = dke.getSystemByName(id);
    assert(system?.name, `system name missing: ${id}`);
    assert(system.description, `system description missing: ${id}`);
    assert(system.categories.length > 0, `system categories missing: ${id}`);
    assert(system.relatedComponents.length > 0, `system components missing: ${id}`);
    assert(system.technicalNotes.length > 0, `system technical notes missing: ${id}`);
  }

  const suspension = dke.getSystemByName('Suspens\u00e3o');
  assert(suspension?.id === 'suspensao', 'accented system lookup failed');
  assert(dke.getSystemByName('unknown') === null, 'unknown system must return null');

  const brakeComponents = dke.getComponents('FREIOS');
  assert(brakeComponents.includes('pastilha de freio'), 'brake components lookup failed');
  assert(dke.getComponents('unknown').length === 0, 'unknown system components must be empty');

  const oilFilterSystems = dke.getSystemsByComponent('Filtro de \u00f3leo');
  assert(oilFilterSystems.length === 2, 'component relation count mismatch');
  assert(oilFilterSystems.some(({ id }) => id === 'motor'), 'motor relation missing');
  assert(oilFilterSystems.some(({ id }) => id === 'filtros'), 'filters relation missing');
  assert(
    dke.componentBelongsToSystem('DISCO DE FREIO', 'freios') === true,
    'component membership must be true'
  );
  assert(
    dke.componentBelongsToSystem('radiador', 'transmissao') === false,
    'component membership must be false'
  );

  const queryContext = {
    source: 'workflow-validation',
    userId: 'dke-validation-user',
    intent: 'domain.knowledge.lookup',
    ai: false,
  };
  const systemQuery = workflow.getDomainSystem('arrefecimento', queryContext);
  const componentsQuery = workflow.getDomainComponents('filtros', queryContext);
  const relationsQuery = workflow.getDomainSystemsByComponent('filtro de oleo', queryContext);
  const membershipQuery = workflow.checkDomainMembership('radiador', 'arrefecimento', queryContext);

  assert(systemQuery.result.id === 'arrefecimento', 'workflow system query failed');
  assert(componentsQuery.result.includes('filtro de cabine'), 'workflow components query failed');
  assert(relationsQuery.result.length === 2, 'workflow relation query failed');
  assert(membershipQuery.result === true, 'workflow membership query failed');

  const workflowQueries = [systemQuery, componentsQuery, relationsQuery, membershipQuery];
  for (const query of workflowQueries) {
    assert(query.ok === true, 'workflow DKE query must succeed');
    assert(query.auditId, 'workflow DKE query auditId missing');
    assert(query.audit.type === 'domain.knowledge.queried', 'workflow DKE audit type mismatch');
    assert(
      query.audit.executionContext.domainKnowledge?.engine === 'domain-knowledge',
      'DKE ExecutionContext reference missing'
    );
    assert(
      query.audit.executionContext.user?.id === 'dke-validation-user',
      'DKE ExecutionContext user missing'
    );
  }

  const auditFile = path.join(dataDir, 'audit.jsonl');
  const auditLines = fs.readFileSync(auditFile, 'utf8').trim().split('\n');
  assert(auditLines.length === 4, 'workflow DKE audit count mismatch');
  assert(platform.engines.memoryEngine.latestExecution() === null, 'DKE queries must not persist capability context');

  console.log(JSON.stringify({
    pass: true,
    engine: 'Domain Knowledge Engine',
    systems: systems.map(({ id, name, categories, relatedComponents, technicalNotes }) => ({
      id,
      name,
      categories: categories.length,
      components: relatedComponents.length,
      technicalNotes: technicalNotes.length,
    })),
    queries: {
      system: systemQuery.result.name,
      components: componentsQuery.result.length,
      relatedSystems: relationsQuery.result.map(({ id }) => id),
      membership: membershipQuery.result,
    },
    audit: {
      records: auditLines.length,
      ids: workflowQueries.map(({ auditId }) => auditId),
    },
    memory: {
      executions: 0,
    },
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    pass: false,
    error: error.message,
  }, null, 2));
  process.exit(1);
}
