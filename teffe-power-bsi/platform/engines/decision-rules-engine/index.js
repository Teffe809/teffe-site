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
}

module.exports = { DecisionRulesEngine };
