import { CompositeDisposable, FilesystemChange } from 'atom';
// import * as atomIde from 'atom-ide';
import {
  ActiveServer,
  AutoLanguageClient,
  ConnectionType,
  LanguageClientConnection,
  LanguageServerProcess,
} from 'atom-languageclient';
import path from 'path';
import { IClientState } from './client-state';
import { SuperConnection } from './connection';
import { SuperDocument } from './document-manager';
import * as lifecycle from './extension-lifecycle';
import { getDefaultSettings } from './server-settings';
import { ArenaPane } from './ui';
import { getConfPath } from './util';

export class GladiatorConfClient extends AutoLanguageClient {
  private _connection: LanguageClientConnection | null = null;
  private _pane = new ArenaPane(this);
  private _settings = getDefaultSettings();
  private _schemas: Map<string, string> = new Map();
  private _configFile: string | null = null;
  private _apiUrl: string | null = null;

  // @ts-ignore
  public activate(state: IClientState) {
    super.activate();

    lifecycle.activate(this._pane, this);

    atom.config.set('core.debugLSP', false);

    if (state.serverSettings) {
      this._settings = state.serverSettings;
    }

    if (state.isPaneActive) {
      this._pane.show();
    }

    this._configFile = getConfPath();

    /* Check if there is a config file in the root of the project. */
    this._configFile = getConfPath();

    if (this._configFile) {
      /* Send notification, that config file was found. */
      atom.notifications.addSuccess(
        `Config file found at: ${path.dirname(this._configFile)}`,
      );
    }
  }

  public serialize(): IClientState {
    return {
      isPaneActive: this._pane.isActive(),
      serverSettings: this._settings,
    };
  }

  public deactivate(): Promise<any> {
    lifecycle.deactivate();

    return super.deactivate();
  }

  public validateConfigFile(event: FilesystemChange) {
    /* In case the file was just created, assign its path to _configFile */
    console.log(event.action);
    switch (event.action) {
      case 'created':
        this._configFile = getConfPath();

        if (this._configFile) {
          atom.notifications.addSuccess(
            `Config file found at: ${path.dirname(this._configFile)}`,
          );
        }
        return;

      case 'deleted':
        this._configFile = null;
        this.parseConfig();
        return;

      case 'modified':
        this.parseConfig();
        return;

      case 'renamed':
        this._configFile = getConfPath();
        if (this._configFile) {
          atom.notifications.addSuccess(
            `Config file found at: ${path.dirname(this._configFile)}`,
          );
        }
        this.parseConfig();
        return;
    }
  }

  public setConfigFile(configPath: string) {
    this._configFile = configPath;
    this.parseConfig();
  }

  // public preInitialization(connection: LanguageClientConnection): void {
  //   connection.onCustom('$/partialResult', () => {});
  // }

  public postInitialization(_server: ActiveServer): void {
    super.postInitialization(_server);

    this._connection = _server.connection;

    this.sendSettings();
  }

  public getGrammarScopes(): string[] {
    return ['source.yaml', 'source.yml'];
  }

  public getLanguageName(): string {
    return 'YAML';
  }

  public getServerName(): string {
    return 'YAML lint';
  }

  public getConnectionType(): ConnectionType {
    return 'stdio';
  }

  public startServerProcess(projectPath: string): LanguageServerProcess {
    return super.spawnChildNode([
      path.join(
        __dirname,
        '../node_modules/yaml-language-server/out/server/src/server.js',
      ),
      '--stdio',
    ]) as LanguageServerProcess;
  }

  public addSchema(schema: string, pattern: string) {
    this._schemas.set(schema, pattern);

    this.sendSchemas();
  }

  public deleteScehma(schema: string) {
    this._schemas.delete(schema);

    this.sendSchemas();
  }

  public sendSchema(schema: string, pattern: string) {
    if (schema.length === 0) {
      return;
    }

    this._settings.settings.yaml.schemas = {
      [schema]: pattern,
    };

    this.sendSettings();
  }

  private sendSchemas() {
    if (this._schemas.size === 0) {
      return;
    }

    this._settings.settings.yaml.schemas = {};

    this._schemas.forEach((pattern, schemaUri) => {
      this._settings.settings.yaml.schemas[schemaUri] = pattern;
    });

    this.sendSettings();
  }

  private sendSettings() {
    if (this._connection !== null) {
      this._connection.didChangeConfiguration(this._settings);
    }
  }

  private parseConfig(): void {
    if (!this._configFile) {
      this.deleteScehma(
        `${this._apiUrl}/gladiator/api/v2/utils/schema/problemset-variants`,
      );
      this.deleteScehma(
        `${this._apiUrl}/gladiator/api/v2/utils/schema/problemset-variants`,
      );
      return;
    }
    const doc = SuperDocument.getBasicTextDocument(this._configFile);

    if (!doc) {
      return;
    }

    this._apiUrl = this.getMatch(
      doc.getText(),
      /^(\cI|\t|\x20)*api-url:(\cI|\t|\x20)*((:|\.|\\|\/|\w|-)+)(\cI|\t|\x20)*/m,
      3,
    );

    if (!this._apiUrl) {
      return;
    }

    const problemsetPath = this.getMatch(
      doc.getText(),
      /^(\cI|\t|\x20)*problemset-definition:(\cI|\t|\x20)*((\.|\\|\/|\w|-)+(\.yaml|\.yml))(\cI|\t|\x20)*/m,
      3,
    );

    if (problemsetPath) {
      this.addSchema(
        `${this._apiUrl}/gladiator/api/v2/utils/schema/problemset-definition`,
        this.getName(problemsetPath),
      );
    }

    const variantsPath = this.getMatch(
      doc.getText(),
      /^(\cI|\t|\x20)*problemset-variants:(\cI|\t|\x20)*((\.|\\|\/|\w|-)+(\.yaml|\.yml))(\cI|\t|\x20)*/m,
      3,
    );

    if (variantsPath) {
      this.addSchema(
        `${this._apiUrl}/gladiator/api/v2/utils/schema/problemset-variants`,
        this.getName(variantsPath),
      );
    }
  }

  private getMatch(
    content: string,
    matcher: RegExp,
    desiredGroup: number,
  ): string | null {
    const match = content.match(matcher);

    if (!match || !match[desiredGroup]) {
      return null;
    }

    return match[desiredGroup];
  }

  private getName(text: string): string {
    return text.replace(/^.*[\\\/]/, '');
  }

  /** Starts the server by starting the process, then initializing the language server and starting adapters */
  private startServer = async (projectPath: string): Promise<ActiveServer> => {
    const process = await this.reportBusyWhile(
      `Starting ${this.getServerName()} for ${path.basename(projectPath)}`,
      async () => this.startServerProcess(projectPath),
    );
    // @ts-ignore
    super.captureServerErrors(process, projectPath);
    const connection = new SuperConnection(
      // @ts-ignore
      super.createRpcConnection(process),
      this.logger,
    );
    this.preInitialization(connection);
    const initializeParams = this.getInitializeParams(projectPath, process);
    const initialization = connection.initialize(initializeParams);
    this.reportBusyWhile(
      `${this.getServerName()} initializing for ${path.basename(projectPath)}`,
      () => initialization,
    );
    const initializeResponse = await initialization;
    const newServer = {
      projectPath,
      process,
      connection,
      capabilities: initializeResponse.capabilities,
      disposable: new CompositeDisposable(),
    };
    this.postInitialization(newServer);
    connection.initialized();
    connection.on('close', () => {
      // @ts-ignore
      if (!super._isDeactivating) {
        // @ts-ignore
        super._serverManager.stopServer(newServer);
        // @ts-ignore
        if (!super._serverManager.hasServerReachedRestartLimit(newServer)) {
          this.logger.debug(
            `Restarting language server for project '${newServer.projectPath}'`,
          );
          // @ts-ignore
          super._serverManager.startServer(projectPath);
        } else {
          this.logger.warn(
            `Language server has exceeded auto-restart limit for project '${
              newServer.projectPath
            }'`,
          );
          atom.notifications.addError(
            `The ${
              this.name
            } language server has exited and exceeded the restart limit for project '${
              newServer.projectPath
            }'`,
          );
        }
      }
    });

    const configurationKey = this.getRootConfigurationKey();
    if (configurationKey) {
      newServer.disposable.add(
        atom.config.observe(configurationKey, config => {
          const mappedConfig = this.mapConfigurationObject(config || {});
          if (mappedConfig) {
            connection.didChangeConfiguration({
              settings: mappedConfig,
            });
          }
        }),
      );
    }

    // @ts-ignore
    super.startExclusiveAdapters(newServer);
    return newServer;
  };
}

module.exports = new GladiatorConfClient();
