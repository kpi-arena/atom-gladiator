import { CompositeDisposable } from 'atom';
// import * as atomIde from 'atom-ide';
import {
  ActiveServer,
  AutoLanguageClient,
  ConnectionType,
  LanguageClientConnection,
  LanguageServerProcess,
} from 'atom-languageclient';
import path from 'path';
import { Disposable } from 'vscode-jsonrpc';
import { IClientState } from './client-state';
import { SuperConnection } from './connection';
import { SuperDocument } from './document-manager';
import * as lifecycle from './extension-lifecycle';
import * as cli from './gladiator-cli-adapter';
import { getDefaultSettings } from './server-settings';
import CommandPalleteView, { ArenaPane } from './ui';
import { getExpectedPath, getProjectOrHomePath } from './util';

export class GladiatorConfClient extends AutoLanguageClient {
  private _connection: LanguageClientConnection | null = null;
  private _pane = new ArenaPane(this);
  private _settings = getDefaultSettings();
  private _schemas: Map<string, string> = new Map();
  private _configPath: string | null = getExpectedPath();
  private _configWatcher: Disposable | null = null;
  private _fileExists: boolean = false;
  private _apiUrl: string | null = null;
  private _variantsPath: string | null = null;
  private _problemsetPath: string | null = null;
  private _subscriptions = new CompositeDisposable();
  private _insertView = new CommandPalleteView();

  // @ts-ignore
  public activate(state: IClientState) {
    super.activate();

    if (!cli.isInstalled()) {
      atom.notifications.addFatalError('gladiator-cli is not installed');
      return false;
    } else {
      cli
        .getSchemaUri()
        .then(value =>
          this.addSchema(
            value.replace(/\r?\n|\r/, ''),
            `/${cli.CONFIG_FILE_NAME}`,
          ),
        );
    }

    this._subscriptions.add(
      atom.commands.add('atom-workspace', {
        'gladiator:toggle': () => this._pane.toggle(),
      }),

      atom.commands.add('atom-workspace', {
        'gladiator:hide': () => this._pane.hide(),
      }),

      atom.commands.add('atom-workspace', {
        'gladiator:show': () => this._pane.show(),
      }),

      atom.commands.add('atom-workspace', {
        'gladiator:generate': () =>
          this._insertView.open(
            'Enter the project directory',
            getProjectOrHomePath(),
            'Enter the path of the directory in which the files will be generated.',
            (input: string) => {
              cli
                .generateFilesToDir(input)
                .then(message => {
                  if (atom.project.getPaths().indexOf(input) < 0) {
                    atom.open({
                      pathsToOpen: [
                        input,
                        path.join(input, cli.CONFIG_FILE_NAME),
                      ],
                      newWindow: true,
                    });
                  } else {
                    atom.open({
                      pathsToOpen: [path.join(input, cli.CONFIG_FILE_NAME)],
                    });
                    atom.notifications.addSuccess(`${message}`);
                  }
                })
                .catch(message => {
                  atom.notifications.addError(`${message}`);
                });
            },
          ),
      }),

      // atom.commands.add('atom-workspace', {
      //   'gladiator:set-config-path': () =>
      //     insertView.open(
      //       'Enter the config file path',
      //       getProjectOrHomePath(),
      //       'Enter the path to the `.gladiator.yml` config file.',
      //       config.setPath,
      //     ),
      // }),
    );

    atom.config.set('core.debugLSP', false);

    if (state.serverSettings) {
      this._settings = state.serverSettings;
    }

    if (state.isPaneActive) {
      this._pane.show();
    }

    this.parseConfig();

    this._configWatcher = atom.project.onDidChangeFiles(events => {
      for (const event of events) {
        if (this._configPath && this._configPath === event.path) {
          switch (event.action) {
            case 'created':
            case 'modified':
            case 'renamed':
              this.parseConfig();
              return;
            case 'deleted':
          }
        }
      }
    });
  }

  public serialize(): IClientState {
    return {
      isPaneActive: this._pane.isActive(),
      serverSettings: this._settings,
    };
  }

  public deactivate(): Promise<any> {
    lifecycle.deactivate();

    if (this._configWatcher) {
      this._configWatcher.dispose();
    }

    return super.deactivate();
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

  // PLZ

  private parseConfig(): void {
    if (!this._configPath) {
      this.deleteTempSchemas();
      return;
    }
    const doc = SuperDocument.getBasicTextDocument(this._configPath);

    if (!doc) {
      this.deleteTempSchemas();
      this._fileExists = false;
      return;
    }

    this._fileExists = true;

    const newApiUrl = this.getMatch(
      doc.getText(),
      /^(\cI|\t|\x20)*api-url:(\cI|\t|\x20)*((:|\.|\\|\/|\w|-)+)(\cI|\t|\x20)*/m,
      3,
    );

    if (this._apiUrl !== newApiUrl) {
      this.deleteTempSchemas();

      this._apiUrl = newApiUrl;
    }

    if (!this._apiUrl) {
      this.deleteTempSchemas();
    }

    const newProbPath = this.getMatch(
      doc.getText(),
      /^(\cI|\t|\x20)*problemset-definition:(\cI|\t|\x20)*((\.|\\|\/|\w|-)+(\.yaml|\.yml))(\cI|\t|\x20)*/m,
      3,
    );

    if (newProbPath && newProbPath !== this._problemsetPath) {
      this._problemsetPath = newProbPath;

      this._schemas.set(
        `${this._apiUrl}/gladiator/api/v2/utils/schema/problemset-definition`,
        this.getName(this._problemsetPath),
      );
    }

    const newVarPath = this.getMatch(
      doc.getText(),
      /^(\cI|\t|\x20)*problemset-variants:(\cI|\t|\x20)*((\.|\\|\/|\w|-)+(\.yaml|\.yml))(\cI|\t|\x20)*/m,
      3,
    );

    if (newVarPath && newVarPath !== this._variantsPath) {
      this._variantsPath = newVarPath;

      this._schemas.set(
        `${this._apiUrl}/gladiator/api/v2/utils/schema/problemset-variants`,
        this.getName(this._variantsPath),
      );
    }
  }

  private deleteTempSchemas() {
    this._schemas.delete(
      `${this._apiUrl}/gladiator/api/v2/utils/schema/problemset-definition`,
    );
    this._schemas.delete(
      `${this._apiUrl}/gladiator/api/v2/utils/schema/problemset-variants`,
    );
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
}

module.exports = new GladiatorConfClient();
