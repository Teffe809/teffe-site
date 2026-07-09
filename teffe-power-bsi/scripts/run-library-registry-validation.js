const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootPlatform } = require('../platform');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function library(overrides) {
  return {
    type: 'knowledge',
    id: 'autoparts-knowledge',
    name: 'Autoparts Knowledge Library',
    version: '1.0.0',
    segment: 'autoparts',
    description: 'Reusable technical knowledge for autoparts.',
    author: 'TEFFE Engineering',
    publishedAt: '2026-07-09T00:00:00.000Z',
    dependencies: [],
    consumingCapabilities: ['service.intelligence'],
    status: 'active',
    ...overrides,
  };
}

function expectError(action, expectedMessage) {
  try {
    action();
  } catch (error) {
    assert(error.message.includes(expectedMessage), `unexpected error: ${error.message}`);
    return error.message;
  }
  throw new Error(`expected error containing: ${expectedMessage}`);
}

function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-library-registry-'));
  const platform = bootPlatform({ dataDir });
  const {
    libraryRegistry,
    libraryDiscovery,
    memoryEngine,
    miaCore,
  } = platform.engines;

  assert(libraryRegistry, 'Library Registry missing');
  assert(libraryDiscovery, 'Library Discovery missing');
  assert(platform.capabilities.length === 9, 'capability behavior changed unexpectedly');
  const initialLibraryCount = libraryRegistry.list().length;
  assert(initialLibraryCount === 1, 'default library registration missing');

  const knowledgeV1 = library({});
  const knowledgeV11 = library({
    version: '1.1.0',
    description: 'Expanded reusable technical knowledge for autoparts.',
    consumingCapabilities: ['service.intelligence', 'recommendation.engine'],
  });
  const decision = library({
    type: 'decision',
    id: 'autoparts-decision-rules',
    name: 'Autoparts Decision Library',
    version: '1.0.0',
    description: 'Reusable deterministic decisions for autoparts.',
    dependencies: [{ id: 'autoparts-knowledge', version: '1.1.0' }],
    consumingCapabilities: ['decision.intelligence'],
  });
  const business = library({
    type: 'business',
    id: 'autoparts-business',
    name: 'Autoparts Business Library',
    version: '2.0.0',
    description: 'Reusable business structures for autoparts.',
    dependencies: [{ id: 'autoparts-decision-rules', version: '1.0.0' }],
    consumingCapabilities: ['budget.intelligence'],
    status: 'draft',
  });
  const commercial = library({
    type: 'commercial',
    id: 'autoparts-commercial',
    name: 'Autoparts Commercial Library',
    version: '1.0.0',
    description: 'Reusable commercial structures for autoparts.',
    dependencies: [{ id: 'autoparts-business', version: '2.0.0' }],
    consumingCapabilities: ['pricing.intelligence'],
  });

  [knowledgeV1, knowledgeV11, decision, business, commercial]
    .forEach((entry) => libraryRegistry.register(entry));

  assert(libraryRegistry.list().length === initialLibraryCount + 5, 'library registration count mismatch');
  assert(libraryRegistry.has('autoparts-knowledge', '1.0.0'), 'knowledge v1 registration missing');
  assert(
    libraryRegistry.get('autoparts-knowledge').version === '1.1.0',
    'latest library version mismatch'
  );
  assert(
    JSON.stringify(libraryRegistry.versions('autoparts-knowledge')) ===
      JSON.stringify(['1.0.0', '1.1.0']),
    'library versions mismatch'
  );

  const activeAutoparts = libraryDiscovery.findByMetadata({
    segment: 'autoparts',
    status: 'active',
  });
  assert(activeAutoparts.length === 4, 'metadata discovery mismatch');
  assert(
    libraryDiscovery.findByConsumer('decision.intelligence')[0]?.type === 'decision',
    'consumer discovery mismatch'
  );
  assert(
    libraryDiscovery.findDependents('autoparts-knowledge', '1.1.0')[0]?.id ===
      'autoparts-decision-rules',
    'dependent discovery mismatch'
  );
  assert(
    libraryDiscovery.resolveDependencies('autoparts-commercial', '1.0.0')[0]?.id ===
      'autoparts-business',
    'dependency resolution mismatch'
  );

  const duplicateError = expectError(
    () => libraryRegistry.register(knowledgeV1),
    'Library already registered'
  );
  const missingDependencyError = expectError(
    () => libraryRegistry.register(library({
      type: 'business',
      id: 'invalid-business',
      name: 'Invalid Business Library',
      dependencies: [{ id: 'missing-library', version: '1.0.0' }],
    })),
    'Library dependency not registered'
  );
  expectError(
    () => libraryRegistry.register(library({
      id: 'invalid-version',
      version: 'v1',
    })),
    'Invalid library version'
  );

  const defensiveCopy = libraryRegistry.get('autoparts-knowledge', '1.1.0');
  defensiveCopy.consumingCapabilities.push('invalid.consumer');
  assert(
    !libraryRegistry.get('autoparts-knowledge', '1.1.0')
      .consumingCapabilities.includes('invalid.consumer'),
    'registered library was mutated externally'
  );

  const latestQuery = miaCore.handleLibraryDiscovery({
    id: 'autoparts-knowledge',
    userId: 'library-validation-user',
  });
  const explicitQuery = miaCore.handleLibraryDiscovery({
    id: 'autoparts-knowledge',
    version: '1.0.0',
    userId: 'library-validation-user',
  });
  const invalidQuery = miaCore.handleLibraryDiscovery({
    id: 'autoparts-knowledge',
    version: 'latest',
    userId: 'library-validation-user',
  });

  assert(latestQuery.ok === true && latestQuery.result.version === '1.1.0', 'latest workflow query failed');
  assert(explicitQuery.ok === true && explicitQuery.result.version === '1.0.0', 'version query failed');
  assert(invalidQuery.ok === false, 'invalid workflow query must fail');
  assert(invalidQuery.error?.code === 'library_version_invalid', 'invalid version error mismatch');
  assert(latestQuery.audit.type === 'library.discovery.queried', 'library query audit missing');
  assert(latestQuery.audit.executionContext.user.id === 'library-validation-user', 'library user context missing');
  assert(
    latestQuery.audit.executionContext.libraries.operation === 'find_by_id',
    'library Execution Context missing'
  );

  const persistedContext = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'context-store.json'), 'utf8')
  );
  assert(persistedContext.executions.length === 0, 'library queries must not create capability executions');
  assert(persistedContext.libraryAccesses.length === 2, 'library access count mismatch');
  assert(memoryEngine.latestLibraryAccess().library.version === '1.0.0', 'latest library access mismatch');

  console.log(JSON.stringify({
    pass: true,
    registry: {
      libraries: libraryRegistry.list().length,
      defaultLibraries: initialLibraryCount,
      types: ['knowledge', 'decision', 'business', 'commercial'],
      knowledgeVersions: libraryRegistry.versions('autoparts-knowledge'),
    },
    discovery: {
      activeAutoparts: activeAutoparts.length,
      decisionConsumers: libraryDiscovery.findByConsumer('decision.intelligence').length,
      knowledgeDependents:
        libraryDiscovery.findDependents('autoparts-knowledge', '1.1.0').length,
    },
    validation: {
      duplicateError,
      missingDependencyError,
      invalidVersionRejected: true,
      defensiveCopies: true,
    },
    workflow: {
      latestVersion: latestQuery.result.version,
      explicitVersion: explicitQuery.result.version,
      invalidVersionCode: invalidQuery.error.code,
      auditId: latestQuery.auditId,
    },
    memory: {
      libraryAccesses: persistedContext.libraryAccesses.length,
      capabilityExecutions: persistedContext.executions.length,
    },
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ pass: false, error: error.message }, null, 2));
  process.exit(1);
}
