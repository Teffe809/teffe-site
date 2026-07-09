const DEFAULT_MEMORY_RETENTION_CONFIG = Object.freeze({
  enabled: true,
  strategy: 'compact',
  maxPayloadBytes: 262144,
  maxStringLength: 8192,
  maxRecordsPerCollection: Object.freeze({
    executions: 500,
    workflows: 200,
    libraryAccesses: 200,
    tenantAccesses: 200,
    communications: 500,
    dispatches: 500,
    understandings: 500,
  }),
  maxRecordsPerTenant: 200,
  maxRecordsPerConversation: 100,
});

const COLLECTIONS = Object.freeze([
  'executions',
  'libraryAccesses',
  'workflows',
  'tenantAccesses',
  'communications',
  'dispatches',
  'understandings',
]);

class MemoryRetention {
  constructor(config = {}) {
    this.config = normalizeConfig(config);
  }

  compactContext(context) {
    const before = estimateBytes(context);
    const stats = {
      enabled: this.config.enabled,
      strategy: this.config.strategy,
      beforeBytes: before,
      afterBytes: before,
      compactedPayloads: 0,
      truncatedStrings: 0,
      removedRecords: 0,
      collections: {},
    };

    if (!this.config.enabled) {
      return { context, stats };
    }

    const compacted = {};
    for (const collection of COLLECTIONS) {
      const records = Array.isArray(context[collection]) ? context[collection] : [];
      const compactedRecords = records.map((record) =>
        this.compactValue(record, [collection], stats)
      );
      const retainedRecords = this.applyRecordLimits(collection, compactedRecords, stats);
      compacted[collection] = retainedRecords;
      stats.collections[collection] = {
        before: records.length,
        after: retainedRecords.length,
      };
    }

    stats.afterBytes = estimateBytes(compacted);
    return { context: compacted, stats };
  }

  compactRecord(collection, record) {
    const stats = {
      enabled: this.config.enabled,
      strategy: this.config.strategy,
      compactedPayloads: 0,
      truncatedStrings: 0,
      removedRecords: 0,
      collections: {},
    };

    if (!this.config.enabled) {
      return record;
    }

    return this.compactValue(record, [collection], stats);
  }

  compactValue(value, path, stats) {
    if (value == null) {
      return value;
    }

    if (typeof value === 'string') {
      if (value.length <= this.config.maxStringLength) {
        return value;
      }

      stats.truncatedStrings += 1;
      return {
        compacted: true,
        reason: 'string_length_limit',
        originalLength: value.length,
        preview: value.slice(0, this.config.maxStringLength),
      };
    }

    if (typeof value !== 'object') {
      return value;
    }

    if (path.at(-1) === 'memory') {
      return compactMemoryReference(value);
    }

    const compacted = Array.isArray(value)
      ? value.map((item, index) => this.compactValue(item, [...path, String(index)], stats))
      : this.compactObject(value, path, stats);

    const payloadBytes = estimateBytes(compacted);
    if (payloadBytes <= this.config.maxPayloadBytes || isEssentialPath(path)) {
      return compacted;
    }

    stats.compactedPayloads += 1;
    return {
      compacted: true,
      reason: 'payload_size_limit',
      originalType: Array.isArray(value) ? 'array' : 'object',
      sizeBytes: payloadBytes,
      reference: compactReference(compacted),
    };
  }

  compactObject(value, path, stats) {
    const entries = [];

    for (const [key, item] of Object.entries(value)) {
      if (key === 'services') {
        stats.compactedPayloads += 1;
        continue;
      }

      entries.push([key, this.compactValue(item, [...path, key], stats)]);
    }

    return Object.fromEntries(entries);
  }

  applyRecordLimits(collection, records, stats) {
    let retained = records;
    const maxRecords = this.config.maxRecordsPerCollection[collection];
    if (Number.isInteger(maxRecords) && maxRecords >= 0 && retained.length > maxRecords) {
      stats.removedRecords += retained.length - maxRecords;
      retained = retained.slice(-maxRecords);
    }

    retained = retainByKey(retained, 'tenantId', this.config.maxRecordsPerTenant, stats);
    retained = retainByKey(retained, 'conversationId', this.config.maxRecordsPerConversation, stats);

    return retained;
  }
}

function normalizeConfig(config) {
  return {
    ...DEFAULT_MEMORY_RETENTION_CONFIG,
    ...config,
    maxRecordsPerCollection: {
      ...DEFAULT_MEMORY_RETENTION_CONFIG.maxRecordsPerCollection,
      ...(config.maxRecordsPerCollection || {}),
    },
  };
}

function compactMemoryReference(memory) {
  const latest = memory.latestExecution;
  return {
    latestExecution: latest
      ? {
          id: latest.id ?? null,
          capability: latest.capability ?? null,
          auditId: latest.auditId ?? null,
          timestamp: latest.timestamp ?? null,
        }
      : null,
  };
}

function compactReference(value) {
  return {
    id: value.id ?? value.runId ?? value.messageId ?? null,
    tenantId: value.tenantId ?? value.tenant?.id ?? null,
    conversationId: value.conversationId ?? value.conversation?.id ?? null,
    capability: value.capability ?? null,
    workflow: value.workflow ?? null,
    auditId: value.auditId ?? value.completedAuditId ?? value.startedAuditId ?? null,
    timestamp: value.timestamp ?? value.completedAt ?? value.startedAt ?? null,
  };
}

function retainByKey(records, key, limit, stats) {
  if (!Number.isInteger(limit) || limit < 0) {
    return records;
  }

  const counts = new Map();
  const retained = [];
  for (const record of [...records].reverse()) {
    const value = record[key] ?? record.executionContext?.[key.replace('Id', '')]?.id ?? null;
    if (!value) {
      retained.push(record);
      continue;
    }

    const count = counts.get(value) || 0;
    if (count < limit) {
      counts.set(value, count + 1);
      retained.push(record);
    } else {
      stats.removedRecords += 1;
    }
  }

  return retained.reverse();
}

function isEssentialPath(path) {
  if (COLLECTIONS.includes(path[0]) && path.length === 1) {
    return true;
  }

  const last = path.at(-1);
  return ['executionContext', 'tenant', 'user', 'runtime', 'audit'].includes(last);
}

function estimateBytes(value) {
  return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
}

module.exports = {
  COLLECTIONS,
  DEFAULT_MEMORY_RETENTION_CONFIG,
  MemoryRetention,
  estimateBytes,
};
