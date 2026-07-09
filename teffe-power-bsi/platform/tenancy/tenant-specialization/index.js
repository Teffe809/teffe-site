const REQUIRED_FIELDS = [
  'tenantId',
  'specialistName',
  'segment',
  'primaryLibrary',
  'primaryWorkflow',
  'personality',
  'textTone',
  'voice',
  'enabledChannels',
  'humanHandoffPolicy',
];

const DEFAULT_TENANT_SPECIALIZATIONS = [
  {
    tenantId: 'autopecas',
    specialistName: 'MIA Autopecas',
    segment: 'autopecas',
    primaryLibrary: {
      id: 'teffe-sales-strategy',
      version: '1.0.0',
    },
    primaryWorkflow: 'autoparts.full-sales-flow',
    personality: {
      role: 'especialista tecnico-comercial de autopecas',
      traits: ['objetiva', 'consultiva', 'tecnica'],
    },
    textTone: {
      style: 'profissional',
      formality: 'media',
      vocabulary: 'tecnico acessivel',
    },
    voice: {
      enabled: false,
      provider: null,
      profile: null,
    },
    enabledChannels: ['web'],
    humanHandoffPolicy: {
      enabled: true,
      triggers: ['manual_review', 'customer_request', 'missing_commercial_data'],
    },
  },
  {
    tenantId: 'grafica',
    specialistName: 'MIA Grafica',
    segment: 'grafica',
    primaryLibrary: {
      id: 'teffe-print-strategy',
      version: '1.0.0',
    },
    primaryWorkflow: 'print.full-sales-flow',
    personality: {
      role: 'especialista em atendimento grafico',
      traits: ['precisa', 'organizada', 'orientada a prazos'],
    },
    textTone: {
      style: 'consultivo',
      formality: 'media',
      vocabulary: 'operacional grafico',
    },
    voice: {
      enabled: false,
      provider: null,
      profile: null,
    },
    enabledChannels: ['web'],
    humanHandoffPolicy: {
      enabled: true,
      triggers: ['approval_required', 'custom_finish', 'customer_request'],
    },
  },
  {
    tenantId: 'iluminacao',
    specialistName: 'MIA Iluminacao',
    segment: 'iluminacao',
    primaryLibrary: {
      id: 'teffe-lighting-strategy',
      version: '1.0.0',
    },
    primaryWorkflow: 'lighting.full-sales-flow',
    personality: {
      role: 'especialista em projetos e produtos de iluminacao',
      traits: ['clara', 'visual', 'consultiva'],
    },
    textTone: {
      style: 'orientativo',
      formality: 'media',
      vocabulary: 'tecnico comercial',
    },
    voice: {
      enabled: false,
      provider: null,
      profile: null,
    },
    enabledChannels: ['web'],
    humanHandoffPolicy: {
      enabled: true,
      triggers: ['project_complexity', 'installation_doubt', 'customer_request'],
    },
  },
];

class TenantSpecializationRegistry {
  constructor({ libraryRegistry, initialTenants = DEFAULT_TENANT_SPECIALIZATIONS } = {}) {
    this.libraryRegistry = libraryRegistry;
    this.tenants = new Map();
    initialTenants.forEach((tenant) => this.register(tenant));
  }

  register(tenant) {
    this.validate(tenant);
    const key = this.normalizeTenantId(tenant.tenantId);
    if (this.tenants.has(key)) {
      throw new Error(`Tenant specialization already registered: ${key}`);
    }

    const normalized = {
      ...tenant,
      tenantId: key,
      enabledChannels: [...tenant.enabledChannels],
      primaryLibrary: { ...tenant.primaryLibrary },
      personality: {
        ...tenant.personality,
        traits: [...tenant.personality.traits],
      },
      textTone: { ...tenant.textTone },
      voice: { ...tenant.voice },
      humanHandoffPolicy: {
        ...tenant.humanHandoffPolicy,
        triggers: [...tenant.humanHandoffPolicy.triggers],
      },
    };
    this.tenants.set(key, normalized);
    return this.copy(normalized);
  }

  get(tenantId) {
    const tenant = this.tenants.get(this.normalizeTenantId(tenantId));
    return tenant ? this.copy(tenant) : null;
  }

  list(filters = {}) {
    return [...this.tenants.values()]
      .filter((tenant) => !filters.segment || tenant.segment === filters.segment)
      .map((tenant) => this.copy(tenant));
  }

  resolvePrimaryLibrary(tenantId) {
    const tenant = this.get(tenantId);
    if (!tenant) {
      return null;
    }

    return this.libraryRegistry.get(
      tenant.primaryLibrary.id,
      tenant.primaryLibrary.version
    );
  }

  resolveRuntimeProfile(tenantId) {
    const tenant = this.get(tenantId);
    if (!tenant) {
      return null;
    }

    const library = this.resolvePrimaryLibrary(tenantId);
    return {
      tenant,
      library,
      workflow: tenant.primaryWorkflow,
      personality: tenant.personality,
      textTone: tenant.textTone,
      voice: tenant.voice,
      enabledChannels: tenant.enabledChannels,
      humanHandoffPolicy: tenant.humanHandoffPolicy,
    };
  }

  has(tenantId) {
    return this.tenants.has(this.normalizeTenantId(tenantId));
  }

  validate(tenant) {
    for (const field of REQUIRED_FIELDS) {
      if (tenant?.[field] == null) {
        throw new Error(`Tenant specialization missing required field: ${field}`);
      }
    }

    const tenantId = this.normalizeTenantId(tenant.tenantId);
    if (!tenantId) {
      throw new Error('Tenant specialization requires tenantId');
    }

    if (!tenant.primaryLibrary?.id || !tenant.primaryLibrary?.version) {
      throw new Error('Tenant specialization requires a primary library id and version');
    }

    if (!this.libraryRegistry.get(tenant.primaryLibrary.id, tenant.primaryLibrary.version)) {
      throw new Error(
        `Tenant primary library not registered: ${tenant.primaryLibrary.id}@${tenant.primaryLibrary.version}`
      );
    }

    if (!tenant.primaryWorkflow || typeof tenant.primaryWorkflow !== 'string') {
      throw new Error('Tenant specialization requires primaryWorkflow');
    }

    if (!Array.isArray(tenant.personality.traits)) {
      throw new Error('Tenant personality traits must be an array');
    }

    if (!Array.isArray(tenant.enabledChannels) || tenant.enabledChannels.length === 0) {
      throw new Error('Tenant enabled channels must be a non-empty array');
    }

    if (!Array.isArray(tenant.humanHandoffPolicy.triggers)) {
      throw new Error('Tenant human handoff triggers must be an array');
    }
  }

  normalizeTenantId(tenantId) {
    return String(tenantId ?? '').trim().toLowerCase();
  }

  copy(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

module.exports = {
  DEFAULT_TENANT_SPECIALIZATIONS,
  TenantSpecializationRegistry,
};
