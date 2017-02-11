import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import npmInstall from 'npm-install-package';

class Plugins {
  constructor(options, imports, register) {
    log.debug('Plugins setup');

    // log.debug('options:', options);
    // log.debug('imports:', imports);

    this.options = options;
    this.iot = imports.iot;
    this.hub = imports.hub;
    this.config = imports.config;

    register(null, {
      plugins: this,
    });

    this.hub.on('ready', (architect) => {
      this.architect = architect;
      this.syncPlugins();
    });
  }

  syncPlugins() {
    // Installed vs active in on disk config
    log.debug('syncing plugin state');

    const plugins = [];

    this.architect.config.forEach((pluginData) => {
      const pluginPath = pluginData.packagePath;
      if (!pluginPath) {
        return;
      }

      const packagePath = path.join(pluginPath, 'package.json');
      const metadata = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const name = metadata.name.replace(/^hubber-/, '');
      const plugin = {
        name,
        version: metadata.version,
        description: metadata.description,
        author: metadata.author,
        license: metadata.license,
        homepage: metadata.homepage,
        bugs: metadata.bugs,
      };
      plugins.push(plugin);
    });

    this.iot.saveState('plugins', plugins);
  }

  execute(payload) {
    log.debug('execute');
    log.debug(payload);

    const command = payload.command;

    switch (command) {
      case 'install':
        this.install(payload);
        break;
      default:
        console.error('Unknown command');
    }
  }

  install({ name, version }) {
    const packageName = `hubber-${name}`;
    const fullPackage = `${packageName}@${version}`;

    // TODO check isn't already installed

    npmInstall(fullPackage, (npmErr) => {
      if (npmErr) {
        log.debug(`Failed to install ${fullPackage}`);
        log.debug(npmErr);
        return;
      }

      log.debug(`Installed ${fullPackage}`);

      // Add to the config
      this.config.addPlugin(packageName);

      // Load it
      this.architect.loadAdditionalPlugins([packageName], (loadErr) => {
        if (loadErr) {
          log.debug(`failed to load plugin ${fullPackage}`);
          log.debug(loadErr);
          return;
        }

        log.debug(`loaded plugin ${fullPackage}`);
        this.syncPlugins();
      });
    });
  }
}

const setup = (options, imports, register) => new Plugins(options, imports, register);

export default setup;