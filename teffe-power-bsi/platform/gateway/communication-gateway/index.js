const MESSAGE_TYPES = ['text', 'audio', 'image', 'document'];

const PAYLOAD_CONTRACTS = {
  text: {
    required: ['text'],
    fields: {
      text: 'string',
    },
  },
  audio: {
    required: ['url', 'durationSeconds', 'mimeType'],
    fields: {
      url: 'string',
      durationSeconds: 'number',
      mimeType: 'string',
      transcript: 'string|null',
    },
  },
  image: {
    required: ['url', 'mimeType'],
    fields: {
      url: 'string',
      mimeType: 'string',
      caption: 'string|null',
    },
  },
  document: {
    required: ['url', 'mimeType', 'fileName'],
    fields: {
      url: 'string',
      mimeType: 'string',
      fileName: 'string',
      title: 'string|null',
    },
  },
};

class CommunicationGateway {
  constructor({ tenantSpecializationRegistry, libraryRegistry }) {
    this.tenantSpecializationRegistry = tenantSpecializationRegistry;
    this.libraryRegistry = libraryRegistry;
  }

  normalizeIncoming(input) {
    return this.normalizeMessage(input, 'inbound');
  }

  normalizeOutgoing(input) {
    return this.normalizeMessage(input, 'outbound');
  }

  normalizeMessage(input, direction) {
    const tenantId = this.normalizeTenantId(input.tenant ?? input.tenantId ?? input.tenant_id);
    const tenantProfile = this.tenantSpecializationRegistry.resolveRuntimeProfile(tenantId);
    if (!tenantProfile) {
      throw new Error(`Tenant specialization not found: ${tenantId}`);
    }

    const channel = String(input.channel ?? input.canal ?? '').trim().toLowerCase();
    const type = String(input.type ?? input.tipo ?? '').trim().toLowerCase();
    const timestamp = input.timestamp
      ? new Date(input.timestamp).toISOString()
      : new Date().toISOString();
    const message = {
      id: input.id ?? `comm_${Date.now()}`,
      direction,
      tenant: {
        id: tenantProfile.tenant.tenantId,
        specialistName: tenantProfile.tenant.specialistName,
        segment: tenantProfile.tenant.segment,
        primaryLibrary: tenantProfile.tenant.primaryLibrary,
        primaryWorkflow: tenantProfile.tenant.primaryWorkflow,
      },
      channel,
      type,
      sender: this.normalizeParty(input.sender ?? input.remetente),
      recipient: this.normalizeParty(input.recipient ?? input.destinatario),
      timestamp,
      payload: this.normalizePayload(type, input.payload),
      metadata: {
        ...(input.metadata ?? input.metadados ?? {}),
        tenantWorkflow: tenantProfile.workflow,
        tenantLibrary: tenantProfile.library
          ? {
            id: tenantProfile.library.id,
            version: tenantProfile.library.version,
            type: tenantProfile.library.type,
          }
          : null,
      },
    };

    return message;
  }

  normalizePayload(type, payload = {}) {
    if (type === 'text') {
      return {
        text: String(payload.text ?? payload.body ?? '').trim(),
      };
    }

    if (type === 'audio') {
      return {
        url: String(payload.url ?? '').trim(),
        durationSeconds: Number(payload.durationSeconds ?? payload.duration_seconds ?? 0),
        mimeType: String(payload.mimeType ?? payload.mime_type ?? '').trim(),
        transcript: payload.transcript == null ? null : String(payload.transcript),
      };
    }

    if (type === 'image') {
      return {
        url: String(payload.url ?? '').trim(),
        mimeType: String(payload.mimeType ?? payload.mime_type ?? '').trim(),
        caption: payload.caption == null ? null : String(payload.caption),
      };
    }

    if (type === 'document') {
      return {
        url: String(payload.url ?? '').trim(),
        mimeType: String(payload.mimeType ?? payload.mime_type ?? '').trim(),
        fileName: String(payload.fileName ?? payload.file_name ?? '').trim(),
        title: payload.title == null ? null : String(payload.title),
      };
    }

    return {};
  }

  normalizeParty(party) {
    if (typeof party === 'string') {
      return { id: party.trim(), name: null };
    }

    return {
      id: String(party?.id ?? '').trim(),
      name: party?.name == null ? null : String(party.name).trim(),
    };
  }

  normalizeTenantId(tenantId) {
    return String(tenantId ?? '').trim().toLowerCase();
  }
}

module.exports = {
  CommunicationGateway,
  MESSAGE_TYPES,
  PAYLOAD_CONTRACTS,
};
