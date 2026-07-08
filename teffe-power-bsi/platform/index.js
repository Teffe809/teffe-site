const path = require('path');
const { AuditLog } = require('./core/audit-log');
const { MemoryEngine } = require('./core/memory-engine');
const { MiaCore } = require('./core/mia-core');
const { PluginEngine } = require('./core/plugin-engine');
const { SecurityGuardian } = require('./core/security-guardian');
const { WorkflowEngine } = require('./core/workflow-engine');
const { CapabilityPipeline } = require('./sdk');

function bootPlatform(options = {}) {
  const baseDir = options.baseDir || path.join(__dirname, '..');
  const dataDir = options.dataDir || path.join(baseDir, 'data');
  const pluginsDir = options.pluginsDir || path.join(__dirname, 'plugins');

  const auditLog = new AuditLog({ dataDir });
  const memoryEngine = new MemoryEngine({ dataDir });
  const securityGuardian = new SecurityGuardian();
  const pluginEngine = new PluginEngine({ pluginsDir });
  const pluginBoot = pluginEngine.boot();
  const capabilityPipeline = new CapabilityPipeline({
    pluginEngine,
    memoryEngine,
    auditLog,
  });
  const workflowEngine = new WorkflowEngine({
    pluginEngine,
    memoryEngine,
    auditLog,
    securityGuardian,
    capabilityPipeline,
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
    },
    plugins: pluginBoot.loaded,
  };
}

module.exports = { bootPlatform };
