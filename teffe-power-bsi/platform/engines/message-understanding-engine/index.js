const PARSER_VERSION = 'autoparts-rules-0.1.0';

const CATEGORY_RULES = [
  {
    category: 'freios',
    keywords: ['freio', 'freios', 'pastilha', 'pastilhas', 'disco', 'discos'],
  },
  {
    category: 'suspensao',
    keywords: ['suspensao', 'suspensão', 'amortecedor', 'amortecedores', 'mola', 'bandeja', 'pivo', 'pivô'],
  },
  {
    category: 'motor',
    keywords: ['motor', 'correia', 'vela', 'velas', 'tensionador'],
  },
  {
    category: 'filtros',
    keywords: ['filtro', 'filtros', 'oleo', 'óleo', 'ar do motor'],
  },
];

const VEHICLE_KEYWORDS = [
  'corolla',
  'civic',
  'onix',
  'gol',
  'palio',
  'hb20',
  'hilux',
];

class MessageUnderstandingEngine {
  understand(message) {
    const text = this.extractText(message);
    const normalizedText = this.normalizeText(text);
    const entities = this.extractEntities(text, normalizedText);
    const workflow = message?.tenant?.primaryWorkflow ?? message?.metadata?.tenantWorkflow ?? null;
    const workflowInput = this.buildWorkflowInput(entities);
    const intent = this.determineIntent({ normalizedText, entities, workflowInput });
    const confidence = this.score({ intent, entities, workflowInput });

    return {
      intent,
      workflow,
      workflowInput,
      confidence,
      entities,
      parserVersion: PARSER_VERSION,
    };
  }

  extractText(message) {
    if (message?.type !== 'text') {
      return '';
    }

    return String(message?.payload?.text ?? '').trim();
  }

  extractEntities(text, normalizedText) {
    const plate = this.extractPlate(text);
    const categories = this.extractCategories(normalizedText);
    const part = this.extractPart(normalizedText, categories);
    const vehicle = this.extractVehicle(normalizedText);
    const year = this.extractYear(normalizedText);
    const engine = this.extractEngine(normalizedText);

    return {
      plate,
      vehicle,
      category: categories.length === 1 ? categories[0] : null,
      categories,
      part,
      year,
      engine,
    };
  }

  extractPlate(text) {
    const match = String(text).toUpperCase()
      .match(/(?:^|[^A-Z0-9])([A-Z]{3}[\s-]?[0-9][A-Z0-9][0-9]{2})(?=$|[^A-Z0-9])/);
    return match ? match[1].replace(/[\s-]/g, '') : null;
  }

  extractCategories(normalizedText) {
    return CATEGORY_RULES
      .filter((rule) => rule.keywords.some((keyword) => normalizedText.includes(this.normalizeText(keyword))))
      .map((rule) => rule.category);
  }

  extractPart(normalizedText, categories) {
    const partKeywords = [
      'amortecedor',
      'pastilha',
      'disco',
      'filtro de oleo',
      'filtro de ar',
      'correia',
      'vela',
      'mola',
      'bandeja',
    ];
    const found = partKeywords.find((keyword) => normalizedText.includes(this.normalizeText(keyword)));
    if (found) {
      return found;
    }

    return categories.length === 1 ? categories[0] : null;
  }

  extractVehicle(normalizedText) {
    return VEHICLE_KEYWORDS.find((vehicle) => normalizedText.includes(vehicle)) ?? null;
  }

  extractYear(normalizedText) {
    const match = normalizedText.match(/\b(19[8-9][0-9]|20[0-4][0-9])\b/);
    return match ? Number(match[1]) : null;
  }

  extractEngine(normalizedText) {
    const match = normalizedText.match(/\b([0-9]\.[0-9])\s?(turbo|flex|16v|8v)?\b/);
    if (!match) {
      return null;
    }

    return [match[1], match[2]].filter(Boolean).join(' ');
  }

  buildWorkflowInput(entities) {
    if (!entities.plate && !entities.category) {
      return null;
    }

    return {
      plate: entities.plate,
      category: entities.category,
      partCategory: entities.category,
      vehicle: entities.vehicle,
      part: entities.part,
      year: entities.year,
      engine: entities.engine,
    };
  }

  determineIntent({ normalizedText, entities, workflowInput }) {
    if (!normalizedText) {
      return 'message.invalid';
    }

    if (entities.categories.length > 1) {
      return 'autoparts.ambiguous_request';
    }

    if (!workflowInput || !workflowInput.plate || !workflowInput.category) {
      return 'autoparts.incomplete_request';
    }

    return 'autoparts.sales_request';
  }

  score({ intent, entities, workflowInput }) {
    if (intent === 'message.invalid') {
      return 0;
    }

    let score = 0.25;
    if (entities.plate) score += 0.25;
    if (entities.category) score += 0.2;
    if (entities.part) score += 0.1;
    if (entities.vehicle) score += 0.05;
    if (entities.year) score += 0.05;
    if (entities.engine) score += 0.05;
    if (workflowInput?.plate && workflowInput?.category) score += 0.05;
    if (intent === 'autoparts.ambiguous_request') score = Math.min(score, 0.55);
    if (intent === 'autoparts.incomplete_request') score = Math.min(score, 0.65);

    return Number(Math.min(score, 0.95).toFixed(2));
  }

  normalizeText(text) {
    return String(text ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}

module.exports = {
  MessageUnderstandingEngine,
  PARSER_VERSION,
};
