const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootPlatform } = require('../platform');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-tenant-specialization-'));
  const platform = bootPlatform({ dataDir });
  const {
    tenantSpecializationRegistry,
    libraryRegistry,
    miaCore,
    memoryEngine,
  } = platform.engines;

  assert(platform.status === 'ok', 'platform boot failed');
  assert(tenantSpecializationRegistry, 'Tenant Specialization Registry missing');
  assert(tenantSpecializationRegistry.list().length === 3, 'mock tenant count mismatch');
  assert(libraryRegistry.list().length === 3, 'tenant library defaults missing');

  const createdTenant = tenantSpecializationRegistry.register({
    tenantId: 'oficina-demo',
    specialistName: 'MIA Oficina',
    segment: 'autopecas',
    primaryLibrary: {
      id: 'teffe-sales-strategy',
      version: '1.0.0',
    },
    primaryWorkflow: 'autoparts.full-sales-flow',
    personality: {
      role: 'especialista de balcão para oficina',
      traits: ['direta', 'tecnica', 'pratica'],
    },
    textTone: {
      style: 'objetivo',
      formality: 'baixa',
      vocabulary: 'tecnico operacional',
    },
    voice: {
      enabled: false,
      provider: null,
      profile: null,
    },
    enabledChannels: ['web', 'api'],
    humanHandoffPolicy: {
      enabled: true,
      triggers: ['manual_review', 'customer_request'],
    },
  });
  assert(createdTenant.tenantId === 'oficina-demo', 'tenant creation failed');
  assert(tenantSpecializationRegistry.list().length === 4, 'tenant registration count mismatch');

  const autopecas = miaCore.handleTenantSpecialization({
    tenantId: 'autopecas',
    userId: 'tenant-validation-user',
  });
  const grafica = miaCore.handleTenantSpecialization({
    tenantId: 'grafica',
    userId: 'tenant-validation-user',
  });
  const iluminacao = miaCore.handleTenantSpecialization({
    tenantId: 'iluminacao',
    userId: 'tenant-validation-user',
  });
  const oficina = miaCore.handleTenantSpecialization({
    tenant_id: 'oficina-demo',
    userId: 'tenant-validation-user',
  });

  assert(autopecas.ok === true, 'autopecas tenant query failed');
  assert(grafica.ok === true, 'grafica tenant query failed');
  assert(iluminacao.ok === true, 'iluminacao tenant query failed');
  assert(oficina.ok === true, 'created tenant query failed');
  assert(autopecas.library.id === 'teffe-sales-strategy', 'autopecas library mismatch');
  assert(grafica.library.id === 'teffe-print-strategy', 'grafica library mismatch');
  assert(iluminacao.library.id === 'teffe-lighting-strategy', 'iluminacao library mismatch');
  assert(autopecas.workflow === 'autoparts.full-sales-flow', 'autopecas workflow mismatch');
  assert(grafica.workflow === 'print.full-sales-flow', 'grafica workflow mismatch');
  assert(iluminacao.workflow === 'lighting.full-sales-flow', 'iluminacao workflow mismatch');
  assert(autopecas.personality.traits.includes('consultiva'), 'tenant personality mismatch');
  assert(oficina.textTone.style === 'objetivo', 'created tenant tone mismatch');
  assert(autopecas.voice.enabled === false, 'voice must remain disabled');

  const invalidTenant = miaCore.handleTenantSpecialization({
    tenantId: 'tenant-inexistente',
  });
  const invalidFormat = miaCore.handleTenantSpecialization({
    tenantId: 'tenant invalido',
  });
  const missingTenant = miaCore.handleTenantSpecialization({});
  assert(invalidTenant.ok === false, 'invalid tenant must fail');
  assert(invalidTenant.error?.code === 'tenant_not_found', 'invalid tenant code mismatch');
  assert(invalidFormat.ok === false, 'invalid tenant format must fail');
  assert(invalidFormat.error?.code === 'tenant_id_invalid', 'invalid format code mismatch');
  assert(missingTenant.ok === false, 'missing tenant must fail');
  assert(missingTenant.error?.code === 'tenant_id_required', 'missing tenant code mismatch');

  const tenantFlow = miaCore.handleAutopartsFullSalesFlow({
    tenantId: 'autopecas',
    plate: 'ABC-1D23',
    category: 'suspensao',
    userId: 'tenant-flow-user',
  });
  assert(tenantFlow.ok === true, 'tenant full sales flow failed');
  assert(tenantFlow.result.sales.library.id === 'teffe-sales-strategy', 'tenant flow sales library mismatch');

  const persistedContext = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'context-store.json'), 'utf8')
  );
  assert(persistedContext.tenantAccesses.length === 4, 'tenant access persistence mismatch');
  assert(persistedContext.workflows.length === 1, 'tenant workflow persistence mismatch');
  assert(persistedContext.executions.length === 9, 'tenant workflow capability persistence mismatch');
  assert(
    persistedContext.executions.every((execution) =>
      execution.executionContext.tenant?.id === 'autopecas'
    ),
    'tenant context not preserved in capability executions'
  );
  assert(
    persistedContext.executions.every((execution) =>
      execution.executionContext.workflow?.tenantSpecialization?.specialistName === 'MIA Autopecas'
    ),
    'tenant specialization not preserved in workflow context'
  );
  assert(memoryEngine.latestTenantAccess().tenantId === 'oficina-demo', 'latest tenant access mismatch');

  const auditLines = fs.readFileSync(path.join(dataDir, 'audit.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const resolvedAudits = auditLines.filter((entry) => entry.type === 'tenant.specialization.resolved');
  const deniedAudits = auditLines.filter((entry) => entry.type === 'tenant.specialization.denied');
  assert(resolvedAudits.length === 4, 'tenant resolved audit count mismatch');
  assert(deniedAudits.length === 3, 'tenant denied audit count mismatch');
  assert(
    resolvedAudits[0].executionContext.tenant.id === 'autopecas',
    'tenant execution context missing'
  );

  console.log(JSON.stringify({
    pass: true,
    module: 'Tenant Specialization Layer',
    tenants: tenantSpecializationRegistry.list().map((tenant) => ({
      tenantId: tenant.tenantId,
      specialistName: tenant.specialistName,
      segment: tenant.segment,
      library: tenant.primaryLibrary.id,
      workflow: tenant.primaryWorkflow,
    })),
    createdTenant: {
      tenantId: createdTenant.tenantId,
      specialistName: createdTenant.specialistName,
      channels: createdTenant.enabledChannels,
    },
    selection: {
      autopecas: {
        library: autopecas.library.id,
        workflow: autopecas.workflow,
        personality: autopecas.personality.role,
      },
      grafica: {
        library: grafica.library.id,
        workflow: grafica.workflow,
      },
      iluminacao: {
        library: iluminacao.library.id,
        workflow: iluminacao.workflow,
      },
    },
    negativeTests: [
      invalidTenant,
      invalidFormat,
      missingTenant,
    ].map(({ ok, error, auditId }) => ({ ok, error, auditId })),
    coverage: {
      tenantCreation: true,
      tenantQuery: true,
      librarySelection: true,
      workflowSelection: true,
      personalitySelection: true,
      invalidTenant: true,
      miaCore: true,
      workflowEngine: true,
      libraryRegistry: true,
      memoryEngine: true,
      securityGuardian: true,
      executionContext: true,
      noWhatsapp: true,
      noAudio: true,
      noAi: true,
      noErp: true,
    },
    memory: {
      tenantAccesses: persistedContext.tenantAccesses.length,
      workflows: persistedContext.workflows.length,
      executions: persistedContext.executions.length,
    },
    audit: {
      resolved: resolvedAudits.length,
      denied: deniedAudits.length,
    },
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ pass: false, error: error.message }, null, 2));
  process.exit(1);
}
