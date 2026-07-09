const { CapabilityError } = require('../../sdk');
const { contracts, objectContract } = require('../../domain/contracts');

module.exports = {
  id: 'service-intelligence',
  name: 'Service Intelligence',
  version: '0.1.0',
  capability: {
    id: 'service.intelligence',
    name: 'Service Intelligence',
    version: '0.1.0',
    description: 'Produces service intelligence exclusively from the Domain Knowledge Engine.',
    requirements: ['domainKnowledge'],
    inputContract: objectContract(
      ['vehicle', 'part', 'category'],
      {
        vehicle: contracts.vehicle,
        part: contracts.part,
        category: contracts.category,
      }
    ),
    resultContract: objectContract(
      ['vehicle', 'part', 'category', ...contracts.serviceIntelligence.required],
      {
        vehicle: contracts.vehicle,
        part: contracts.part,
        category: contracts.category,
        ...contracts.serviceIntelligence.properties,
      }
    ),
    outputContract: {
      success: {
        ok: true,
        system: 'object',
        relatedComponents: 'array',
        recommendations: 'array',
        priority: 'string',
        technicalJustification: 'string',
        auditId: 'string',
      },
      failure: {
        ok: false,
        error: {
          code: 'string',
          message: 'string',
        },
        auditId: 'string',
      },
    },
  },
  execute(input, executionContext) {
    const dke = executionContext.services?.domainKnowledge;
    if (!dke) {
      throw new CapabilityError(
        'domain_knowledge_unavailable',
        'Domain Knowledge Engine is required for Service Intelligence'
      );
    }

    const intelligence = dke.getServiceIntelligence({
      category: input.category,
      component: input.part.name,
    });
    if (!intelligence) {
      throw new CapabilityError(
        'domain_system_not_found',
        'No domain system was found for the provided category and component'
      );
    }

    return {
      source: 'domain-knowledge-engine',
      vehicle: input.vehicle,
      part: input.part,
      category: input.category,
      ...intelligence,
    };
  },
};
