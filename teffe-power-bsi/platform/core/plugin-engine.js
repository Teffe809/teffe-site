const fs = require('fs');
const path = require('path');

class PluginEngine {
  constructor({ pluginsDir, capabilityRegistry }) {
    this.pluginsDir = pluginsDir;
    this.capabilityRegistry = capabilityRegistry;
    this.plugins = new Map();
  }

  boot() {
    const pluginFolders = fs
      .readdirSync(this.pluginsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const folder of pluginFolders) {
      const plugin = require(path.join(this.pluginsDir, folder));
      this.plugins.set(plugin.id, plugin);

      if (this.capabilityRegistry && plugin.capability) {
        this.capabilityRegistry.register({
          ...plugin.capability,
          pluginId: plugin.id,
        });
      }
    }

    return {
      loaded: Array.from(this.plugins.keys()),
      capabilities: this.capabilityRegistry?.list() ?? [],
    };
  }

  execute(pluginId, input, context) {
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    return plugin.execute(input, context);
  }
}

module.exports = { PluginEngine };
