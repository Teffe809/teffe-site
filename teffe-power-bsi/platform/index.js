const path = require('path');
const { AuditLog } = require('./core/audit-log');
const { DomainKnowledgeEngine } = require('./core/domain-knowledge-engine');
const { DecisionRulesEngine } = require('./engines/decision-rules-engine');
const { MemoryEngine } = require('./core/memory-engine');
const { MiaCore } = require('./core/mia-core');
const { PluginEngine } = require('./core/plugin-engine');
const { SecurityGuardian } = require('./core/security-guardian');
const { WorkflowEngine } = require('./core/workflow-engine');
const { CapabilityDiscovery, CapabilityRegistry } = require('./registry');
const { CapabilityPipeline, ContractValidator } = require('./sdk');

function bootPlatform(options = {}) {
  const baseDir = options.baseDir || path.join(__dirname, '..');
  const dataDir = options.dataDir || path.join(baseDir, 'data');
  const pluginsDir = options.pluginsDir || path.join(__dirname, 'plugins');

  const auditLog = new AuditLog({ dataDir });
  const memoryEngine = new MemoryEngine({ dataDir });
  const securityGuardian = new SecurityGuardian();
  const domainKnowledgeEngine = new DomainKnowledgeEngine();
  const decisionRulesEngine = new DecisionRulesEngine();
  const capabilityRegistry = new CapabilityRegistry();
  const capabilityDiscovery = new CapabilityDiscovery({ registry: capabilityRegistry });
  const pluginEngine = new PluginEngine({ pluginsDir, capabilityRegistry });
  const pluginBoot = pluginEngine.boot();
  const contractValidator = new ContractValidator();
  const capabilityPipeline = new CapabilityPipeline({
    pluginEngine,
    memoryEngine,
    auditLog,
    domainKnowledgeEngine,
    decisionRulesEngine,
    contractValidator,
  });
  const workflowEngine = new WorkflowEngine({
    pluginEngine,
    memoryEngine,
    auditLog,
    securityGuardian,
    capabilityPipeline,
    capabilityRegistry,
    domainKnowledgeEngine,
    decisionRulesEngine,
  });
  const miaCore = new MiaCore({ workflowEngine });

  return {
    status: 'ok',
    bootedAt: new Date().toISOString(),
    engines: {
      pluginEngine,
      workflowEngine,
      memoryEngine,
      securityGuardian,
      miaCore,
      auditLog,
      capabilityPipeline,
      capabilityRegistry,
      capabilityDiscovery,
      contractValidator,
      domainKnowledgeEngine,
      decisionRulesEngine,
    },
    plugins: pluginBoot.loaded,
    capabilities: capabilityRegistry.list(),
  };
}

module.exports = { bootPlatform };
