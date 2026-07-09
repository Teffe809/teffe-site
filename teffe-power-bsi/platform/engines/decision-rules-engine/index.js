function createDecision(type, priority, reason, nextAction, relatedItemIds = []) {
  return {
    id: `decision_${type}`,
    type,
    priority,
    reason,
    nextAction,
    relatedItemIds,
  };
}

class DecisionRulesEngine {
  evaluate(pricing) {
    if (!pricing || !Array.isArray(pricing.items)) {
      throw new Error('Decision Rules Engine requires a valid pricing context');
    }

    const decisions = [];
    const complementaryItems = pricing.items.filter((item) => item.type === 'complementary');
    const missingCommercialData = pricing.items.filter((item) =>
      item.pricing.quantity == null || item.pricing.unitPrice == null
    );
    const awaitingStockItems = pricing.items.filter((item) =>
      item.pricing.status === 'awaiting_stock'
    );
    const manualReviewItems = pricing.items.filter((item) =>
      item.pricing.status === 'manual_review'
    );

    if (complementaryItems.length > 0) {
      decisions.push(createDecision(
        'suggest_complementary_sale',
        'medium',
        'O orcamento contem itens complementares tecnicamente estruturados.',
        'Apresentar os itens complementares ao cliente.',
        complementaryItems.map(({ id }) => id)
      ));
    }

    if (complementaryItems.length >= 2) {
      decisions.push(createDecision(
        'suggest_kit',
        'medium',
        'Existem componentes complementares suficientes para uma oferta agrupada.',
        'Preparar uma sugestao de kit comercial.',
        complementaryItems.map(({ id }) => id)
      ));
    }

    if (missingCommercialData.length > 0) {
      decisions.push(createDecision(
        'request_more_information',
        'high',
        'Quantidade ou preco ainda nao foi definido para todos os itens.',
        'Solicitar os dados comerciais pendentes.',
        missingCommercialData.map(({ id }) => id)
      ));
    }

    if (awaitingStockItems.length > 0) {
      decisions.push(createDecision(
        'await_stock',
        'high',
        'Existem itens aguardando confirmacao de estoque.',
        'Aguardar disponibilidade antes de concluir o orcamento.',
        awaitingStockItems.map(({ id }) => id)
      ));
    }

    if (manualReviewItems.length > 0) {
      decisions.push(createDecision(
        'route_to_human',
        'critical',
        'Existem itens marcados para revisao manual.',
        'Encaminhar o caso para atendimento humano.',
        manualReviewItems.map(({ id }) => id)
      ));
    }

    const canProceed =
      missingCommercialData.length === 0 &&
      awaitingStockItems.length === 0 &&
      manualReviewItems.length === 0 &&
      pricing.totals.total != null;

    if (canProceed) {
      decisions.push(createDecision(
        'proceed_to_budget',
        'high',
        'A estrutura comercial possui os dados necessarios para prosseguir.',
        'Prosseguir para formalizacao do orcamento.',
        pricing.items.map(({ id }) => id)
      ));
    }

    if (decisions.length === 0) {
      decisions.push(createDecision(
        'route_to_human',
        'high',
        'Nenhuma decisao automatica aplicavel foi encontrada.',
        'Encaminhar o caso para avaliacao humana.'
      ));
    }

    return {
      decisions,
      summary: {
        canProceed,
        requiresHuman: decisions.some(({ type }) => type === 'route_to_human'),
        awaitingInformation: decisions.some(({ type }) => type === 'request_more_information'),
        awaitingStock: decisions.some(({ type }) => type === 'await_stock'),
        decisionCount: decisions.length,
      },
      justifications: decisions.map(({ reason }) => reason),
    };
  }

  buildSalesStrategy({ pricing, decision, library }) {
    if (!pricing || !decision || !library) {
      throw new Error('Decision Rules Engine requires pricing, decision and library contexts');
    }

    const decisionTypes = decision.decisions.map(({ type }) => type);
    const hasComplementaryOpportunity =
      decisionTypes.includes('suggest_complementary_sale') ||
      decisionTypes.includes('suggest_kit');
    const complementaryItemIds = decision.decisions
      .filter(({ type }) =>
        type === 'suggest_complementary_sale' || type === 'suggest_kit'
      )
      .flatMap(({ relatedItemIds }) => relatedItemIds);
    const uniqueComplementaryItemIds = [...new Set(complementaryItemIds)];
    const requiresHuman =
      decision.summary.requiresHuman ||
      decisionTypes.includes('route_to_human');

    let commercialPriority = 'low';
    if (requiresHuman) {
      commercialPriority = 'critical';
    } else if (hasComplementaryOpportunity) {
      commercialPriority = 'high';
    } else if (decision.summary.canProceed) {
      commercialPriority = 'medium';
    }

    const commercialRisks = [];
    if (decisionTypes.includes('request_more_information')) {
      commercialRisks.push('Dados comerciais incompletos podem impedir a conclusao da proposta.');
    }
    if (decisionTypes.includes('await_stock')) {
      commercialRisks.push('Disponibilidade de estoque pendente pode alterar o prazo comercial.');
    }
    if (requiresHuman) {
      commercialRisks.push('O caso exige validacao humana antes do proximo compromisso comercial.');
    }
    if (pricing.totals.total == null) {
      commercialRisks.push('Total comercial ainda nao definido.');
    }

    const suggestedApproach = requiresHuman
      ? 'Realizar abordagem assistida por um vendedor responsavel.'
      : hasComplementaryOpportunity
        ? 'Apresentar a solucao principal junto aos complementos tecnicamente relacionados.'
        : decision.summary.canProceed
          ? 'Apresentar a proposta comercial estruturada para confirmacao.'
          : 'Coletar os dados pendentes antes de apresentar uma proposta.';

    return {
      library: {
        id: library.id,
        version: library.version,
        type: library.type,
        segment: library.segment,
      },
      complementarySaleOpportunity: {
        available: hasComplementaryOpportunity,
        itemIds: uniqueComplementaryItemIds,
      },
      commercialPriority,
      technicalJustification: decision.justifications.join(' '),
      suggestedApproach,
      requiresHuman,
      commercialRisks,
      nextSteps: [...new Set(decision.decisions.map(({ nextAction }) => nextAction))],
    };
  }
}

module.exports = { DecisionRulesEngine };
