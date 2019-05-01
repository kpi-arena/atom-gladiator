import { CompositeDisposable } from 'atom';
// import * as atomIde from 'atom-ide';
import {
  ActiveServer,
  AutoLanguageClient,
  ConnectionType,
  LanguageClientConnection,
  LanguageServerProcess,
} from 'atom-languageclient';
import * as path from 'path';
import { TextDocument } from 'vscode-languageserver-protocol';
import * as yaml from 'yaml-ast-parser';
import { IClientState } from './client-state';
import { ConfigWatcher } from './config-watcher';
import { SuperConnection } from './connection';
import { FormatValidation } from './format-schema';
import * as cli from './gladiator-cli-adapter';
import { getDefaultSettings } from './server-settings';
import CommandPalleteView, { ArenaPane } from './ui';

export class GladiatorConfClient extends AutoLanguageClient {
  private _connection: LanguageClientConnection | null = null;
  private _pane = new ArenaPane(this);
  private _settings = getDefaultSettings();
  private _config: ConfigWatcher | null = null;
  private _schemas: Map<string, string> = new Map();
  // private _configPath: string | null = getExpectedPath();
  // private _configWatcher: Disposable | null = null;
  private _fileExists: boolean = false;
  private _apiUrl: string | null = null;
  private _variantsPath: string | null = null;
  private _problemsetPath: string | null = null;
  private _subscriptions = new CompositeDisposable();
  private _insertView = new CommandPalleteView();

  // @ts-ignore
  public activate(state: IClientState) {
    super.activate();

    this._config = new ConfigWatcher(atom.project.getPaths()[0], this);

    if (!cli.isInstalled()) {
      atom.notifications.addFatalError('gladiator-cli is not installed');
      return false;
    } else {
      cli.getSchemaUri().then(
        value => this.addSchema(value, cli.CONFIG_FILE_NAME),

        // this.addSchema(
        //   value.replace(/\r?\n|\r/, ''),
        //   `/${cli.CONFIG_FILE_NAME}`,
        // ),
      );
    }

    const format = new FormatValidation(
      yaml.safeLoad(`
    package:
      - $
      - orig-file: $
      - directory:
          into: $
          include:
            - $
          exclude:
            - $
    problemset-definition: $
    problemset-variants: $
        `),
    );
    format.subPath = 'D:\\Develop\\test';

    this._subscriptions.add(
      atom.commands.add('atom-workspace', {
        'gladiator:test': () => {
          const doc = atom.workspace.getActiveTextEditor();

          if (doc) {
            format.doc = TextDocument.create(
              '',
              '',
              0,
              doc.getBuffer().getText(),
            );

            console.log(
              format.getDiagnostics(yaml.safeLoad(doc.getBuffer().getText())),
            );
            console.log(yaml.safeLoad(doc.getBuffer().getText()));
            format.getCompletionItems({
              textDocument: {
                uri: '',
              },
              position: {
                line: 15,
                character: 16,
              },
            });
          }
        },
      }),
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
        'gladiator:generate-files': () =>
          cli.generateFilesToDir(this._insertView),
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

      atom.commands.add('atom-workspace', {
        'gladiator:pack-problemset': () => {
          if (!this._fileExists) {
            atom.notifications.addError('Missing .gladiator.yml file');
          } else {
            cli.problemsetPack(this._insertView);
          }
        },
      }),

      atom.commands.add('atom-workspace', {
        'gladiator:push-problemset': () => {
          if (!this._fileExists) {
            atom.notifications.addError('Missing .gladiator.yml file');
          } else {
            cli.problemsetPush(this._insertView);
          }
        },
      }),
    );

    atom.config.set('core.debugLSP', true);

    if (state.serverSettings) {
      this._settings = state.serverSettings;
    }

    if (state.isPaneActive) {
      this._pane.show();
    }
  }

  public serialize(): IClientState {
    return {
      isPaneActive: this._pane.isActive(),
      serverSettings: this._settings,
    };
  }

  public deactivate(): Promise<any> {
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
  public lol() {
    console.log('\n\nloool\n\n');
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

  public addSchema(schema: string, pattern: string): void {
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

  public deleteTempSchemas() {
    this._schemas = new Map();
    cli.getSchemaUri().then(value => {
      this.addSchema(value, cli.CONFIG_FILE_NAME);
      this.sendSchemas();
    });
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

  // private checkIfFileExists(filePath: string) {
  //   if (!this._configPath) {
  //     return;
  //   }
  //   fs.exists(path.join(path.dirname(this._configPath), filePath), (exists) => {
  //     if (!exists) {
  //       this.provideCodeFormat
  //     }
  //   });
  // }

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

  /**
   * Same as `super.startServer()`, but the method is private and doesn't allow
   * any changes to be made. This method is implemented  to set the connection
   * to `SuperConnection`.
   */
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
