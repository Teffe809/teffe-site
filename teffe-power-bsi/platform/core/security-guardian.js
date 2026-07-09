class SecurityGuardian {
  validateVehicleIdentificationRequest(input) {
    const rawPlate = input?.plate == null ? '' : String(input.plate);
    const upperPlate = rawPlate.toUpperCase();

    if (!upperPlate.trim()) {
      return this.deny('plate_required', 'plate is required', null);
    }

    if (/[^A-Z0-9\s-]/.test(upperPlate)) {
      return this.deny('plate_invalid_characters', 'plate contains invalid characters', null);
    }

    const normalizedPlate = upperPlate.replace(/[\s-]/g, '');

    if (normalizedPlate.length < 7) {
      return this.deny('plate_too_short', 'plate must have 7 alphanumeric characters', normalizedPlate);
    }

    if (normalizedPlate.length > 7) {
      return this.deny('plate_too_long', 'plate must have 7 alphanumeric characters', normalizedPlate);
    }

    if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizedPlate)) {
      return this.deny('plate_invalid_format', 'plate must match Brazilian simple format', normalizedPlate);
    }

    return {
      allowed: true,
      normalizedInput: {
        ...input,
        plate: normalizedPlate,
      },
      normalizedPlate,
      sanitizedInput: {
        ...input,
        plate: normalizedPlate,
      },
    };
  }

  validateVehicleCompatibilityRequest(input) {
    const category = this.normalizeCategory(input?.category);
    const supportedCategories = ['freios', 'suspensao', 'motor', 'filtros'];

    if (!input?.vehicle) {
      return this.denyRequest('vehicle_required', 'identified vehicle is required');
    }

    if (!category) {
      return this.denyRequest('category_required', 'part category is required');
    }

    if (!supportedCategories.includes(category)) {
      return this.denyRequest(
        'category_not_supported',
        `part category must be one of: ${supportedCategories.join(', ')}`
      );
    }

    return {
      allowed: true,
      normalizedInput: {
        ...input,
        category,
      },
    };
  }

  validateStockAvailabilityRequest(input) {
    if (!input?.vehicle) {
      return this.denyRequest('vehicle_required', 'identified vehicle is required');
    }

    if (!input?.part) {
      return this.denyRequest('part_required', 'compatible part is required');
    }

    const internalCode = String(input.part.internalCode ?? '').trim().toUpperCase();
    if (!internalCode) {
      return this.denyRequest('part_internal_code_required', 'part internal code is required');
    }

    const supportedCodes = [
      'TFF-FRE-001',
      'TFF-FRE-002',
      'TFF-SUS-001',
      'TFF-MOT-001',
      'TFF-FIL-001',
      'TFF-FIL-002',
    ];
    if (!supportedCodes.includes(internalCode)) {
      return this.denyRequest('part_not_found', 'compatible part was not found in mock stock');
    }

    return {
      allowed: true,
      normalizedInput: {
        ...input,
        part: {
          ...input.part,
          internalCode,
        },
      },
    };
  }

  validateServiceIntelligenceRequest(input) {
    if (!input?.vehicle) {
      return this.denyRequest('vehicle_required', 'identified vehicle is required');
    }

    if (!input?.part) {
      return this.denyRequest('part_required', 'main part is required');
    }

    const category = this.normalizeCategory(input.category);
    if (!category) {
      return this.denyRequest('category_required', 'category is required');
    }

    return {
      allowed: true,
      normalizedInput: {
        ...input,
        category,
        part: {
          ...input.part,
          name: String(input.part.name).trim(),
        },
      },
    };
  }

  validateRecommendationRequest(input) {
    if (!input?.vehicle) {
      return this.denyRequest('vehicle_required', 'identified vehicle is required');
    }

    if (!input?.part) {
      return this.denyRequest('part_required', 'main part is required');
    }

    if (!input?.serviceIntelligence) {
      return this.denyRequest('service_intelligence_required', 'Service Intelligence result is required');
    }

    if (input.serviceIntelligence.source !== 'domain-knowledge-engine') {
      return this.denyRequest(
        'service_intelligence_source_invalid',
        'Service Intelligence must originate from the Domain Knowledge Engine'
      );
    }

    const category = this.normalizeCategory(input.category);
    if (!category) {
      return this.denyRequest('category_required', 'category is required');
    }

    return {
      allowed: true,
      normalizedInput: {
        ...input,
        category,
        part: {
          ...input.part,
          name: String(input.part.name).trim(),
        },
      },
    };
  }

  validateBudgetIntelligenceRequest(input) {
    if (!input?.vehicle) {
      return this.denyRequest('vehicle_required', 'identified vehicle is required');
    }

    if (!input?.part) {
      return this.denyRequest('part_required', 'main part is required');
    }

    if (input?.serviceIntelligence?.source !== 'domain-knowledge-engine') {
      return this.denyRequest(
        'service_intelligence_source_invalid',
        'Service Intelligence must originate from the Domain Knowledge Engine'
      );
    }

    if (input?.recommendation?.source !== 'service-intelligence+domain-knowledge-engine') {
      return this.denyRequest(
        'recommendation_source_invalid',
        'Recommendation must originate from Service Intelligence and Domain Knowledge Engine'
      );
    }

    const category = this.normalizeCategory(input.category);
    if (!category) {
      return this.denyRequest('category_required', 'category is required');
    }

    return {
      allowed: true,
      normalizedInput: {
        ...input,
        category,
        part: {
          ...input.part,
          name: String(input.part.name).trim(),
        },
      },
    };
  }

  validatePricingIntelligenceRequest(input) {
    if (
      input?.budget?.source !==
      'service-intelligence+recommendation-engine+domain-knowledge-engine'
    ) {
      return this.denyRequest(
        'budget_source_invalid',
        'Budget must originate from Budget Intelligence'
      );
    }

    return {
      allowed: true,
      normalizedInput: input,
    };
  }

  validateDecisionIntelligenceRequest(input) {
    if (input?.pricing?.source !== 'budget-intelligence') {
      return this.denyRequest(
        'pricing_source_invalid',
        'Decision input must originate from Pricing Intelligence'
      );
    }

    return {
      allowed: true,
      normalizedInput: input,
    };
  }

  validateLibraryDiscoveryRequest(input) {
    const id = String(input?.id ?? '').trim();
    const version = input?.version == null ? null : String(input.version).trim();

    if (!id) {
      return this.denyRequest('library_id_required', 'library id is required');
    }

    if (version && !/^\d+\.\d+\.\d+$/.test(version)) {
      return this.denyRequest('library_version_invalid', 'library version must use semantic versioning');
    }

    return {
      allowed: true,
      normalizedInput: { id, version },
    };
  }

  validateSalesIntelligenceRequest(input) {
    if (input?.pricing?.source !== 'budget-intelligence') {
      return this.denyRequest(
        'pricing_source_invalid',
        'Sales input must originate from Pricing Intelligence'
      );
    }

    if (input?.decision?.source !== 'pricing-intelligence') {
      return this.denyRequest(
        'decision_source_invalid',
        'Sales input must originate from Decision Intelligence'
      );
    }

    return {
      allowed: true,
      normalizedInput: input,
    };
  }

  validateAutopartsFullSalesFlowRequest(input) {
    const plate = input?.plate == null ? '' : String(input.plate).trim();
    const category = this.normalizeCategory(input?.category ?? input?.partCategory);

    if (!plate) {
      return this.denyRequest('vehicle_required', 'vehicle plate is required');
    }

    if (!category) {
      return this.denyRequest('part_required', 'part category is required');
    }

    return {
      allowed: true,
      normalizedInput: {
        ...input,
        plate,
        category,
      },
    };
  }

  validateTenantSpecializationRequest(input) {
    const tenantId = String(input?.tenantId ?? input?.tenant_id ?? '').trim().toLowerCase();

    if (!tenantId) {
      return this.denyRequest('tenant_id_required', 'tenant id is required');
    }

    if (!/^[a-z0-9_-]+$/.test(tenantId)) {
      return this.denyRequest('tenant_id_invalid', 'tenant id format is invalid');
    }

    return {
      allowed: true,
      normalizedInput: { tenantId },
    };
  }

  validateCommunicationMessageRequest(input) {
    const tenantId = String(input?.tenant ?? input?.tenantId ?? input?.tenant_id ?? '')
      .trim()
      .toLowerCase();
    const channel = String(input?.channel ?? input?.canal ?? '').trim().toLowerCase();
    const type = String(input?.type ?? input?.tipo ?? '').trim().toLowerCase();
    const sender = input?.sender ?? input?.remetente;
    const recipient = input?.recipient ?? input?.destinatario;
    const payload = input?.payload;
    const supportedTypes = ['text', 'audio', 'image', 'document'];

    if (!tenantId) {
      return this.denyRequest('tenant_id_required', 'tenant id is required');
    }

    if (!/^[a-z0-9_-]+$/.test(tenantId)) {
      return this.denyRequest('tenant_id_invalid', 'tenant id format is invalid');
    }

    if (!channel) {
      return this.denyRequest('channel_required', 'communication channel is required');
    }

    if (!type) {
      return this.denyRequest('message_type_required', 'message type is required');
    }

    if (!supportedTypes.includes(type)) {
      return this.denyRequest(
        'message_type_not_supported',
        `message type must be one of: ${supportedTypes.join(', ')}`
      );
    }

    if (!this.hasPartyId(sender)) {
      return this.denyRequest('sender_required', 'message sender is required');
    }

    if (!this.hasPartyId(recipient)) {
      return this.denyRequest('recipient_required', 'message recipient is required');
    }

    if (!payload || typeof payload !== 'object') {
      return this.denyRequest('payload_required', 'message payload is required');
    }

    const payloadValidation = this.validateCommunicationPayload(type, payload);
    if (!payloadValidation.allowed) {
      return payloadValidation;
    }

    if (input?.timestamp && Number.isNaN(Date.parse(input.timestamp))) {
      return this.denyRequest('timestamp_invalid', 'message timestamp is invalid');
    }

    return {
      allowed: true,
      normalizedInput: {
        ...input,
        tenantId,
        channel,
        type,
      },
    };
  }

  normalizeCategory(category) {
    return String(category ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  denyRequest(code, message) {
    return {
      allowed: false,
      normalizedInput: null,
      error: { code, message },
    };
  }

  deny(code, message, normalizedPlate) {
    return {
      allowed: false,
      normalizedInput: normalizedPlate ? { normalizedPlate } : null,
      normalizedPlate,
      error: {
        code,
        message,
      },
    };
  }

  validateCommunicationPayload(type, payload) {
    if (type === 'text' && !String(payload.text ?? payload.body ?? '').trim()) {
      return this.denyRequest('text_payload_required', 'text payload is required');
    }

    if (type === 'audio') {
      if (!String(payload.url ?? '').trim()) {
        return this.denyRequest('audio_url_required', 'audio url is required');
      }
      if (!String(payload.mimeType ?? payload.mime_type ?? '').trim()) {
        return this.denyRequest('audio_mime_type_required', 'audio mime type is required');
      }
    }

    if (type === 'image') {
      if (!String(payload.url ?? '').trim()) {
        return this.denyRequest('image_url_required', 'image url is required');
      }
      if (!String(payload.mimeType ?? payload.mime_type ?? '').trim()) {
        return this.denyRequest('image_mime_type_required', 'image mime type is required');
      }
    }

    if (type === 'document') {
      if (!String(payload.url ?? '').trim()) {
        return this.denyRequest('document_url_required', 'document url is required');
      }
      if (!String(payload.mimeType ?? payload.mime_type ?? '').trim()) {
        return this.denyRequest('document_mime_type_required', 'document mime type is required');
      }
      if (!String(payload.fileName ?? payload.file_name ?? '').trim()) {
        return this.denyRequest('document_file_name_required', 'document file name is required');
      }
    }

    return { allowed: true };
  }

  hasPartyId(party) {
    if (typeof party === 'string') {
      return party.trim().length > 0;
    }

    return String(party?.id ?? '').trim().length > 0;
  }
}

module.exports = { SecurityGuardian };
