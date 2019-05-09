import { CompositeDisposable } from 'atom';
import {
  ActiveServer,
  AutoLanguageClient,
  ConnectionType,
  LanguageClientConnection,
  LanguageServerProcess,
} from 'atom-languageclient';
import * as path from 'path';
import { IClientState } from './client-state';
import * as cli from './gladiator-cli-adapter';
import {
  getAllConfigs,
  getConfigSchema,
  getConfigValues,
  IConfigValues,
} from './gladiator-config';
import { getDefaultSettings } from './server-settings';
import { GladiatorConnection } from './super-connection';
import CommandPalleteView from './ui';

export class GladiatorConfClient extends AutoLanguageClient {
  private _connection: LanguageClientConnection | null = null;
  private _settings = getDefaultSettings();
  private _configValues: Map<string, IConfigValues> = new Map();
  private _subscriptions = new CompositeDisposable();
  private _insertView = new CommandPalleteView();

  // @ts-ignore
  public activate(state: IClientState) {
    super.activate();

    if (!cli.isInstalled()) {
      atom.notifications.addFatalError('gladiator-cli is not installed');
    }

    /* Looking for all `.gladitor.yml` files in all projects and registering
    their values to schemas. */
    getAllConfigs()
      .then(paths => {
        paths.forEach(configPath => {
          getConfigValues(configPath)
            .then(values => {
              this._configValues.set(configPath, values);
            })
            .catch();
        });
      })
      .then(() =>
        cli
          .getConfigFilePath()
          .then(newPath => {
            if (this._configValues.has(newPath)) {
              this.sendSettings(this._configValues.get(
                newPath,
              ) as IConfigValues);
            }
          })
          .catch(),
      );

    this._subscriptions.add(
      /* Registering file watcher related to .gladiator.yml files. */
      atom.project.onDidChangeFiles(events => {
        for (const event of events) {
          if (event.path.match(cli.CONFIG_FILE_REGEX)) {
            switch (event.action) {
              case 'deleted':
                this._configValues.delete(event.path);
                break;
              default:
                getConfigValues(event.path)
                  .then(values => {
                    this.sendSettings(values);
                    this._configValues.set(event.path, values);
                  })
                  .catch(() => {
                    this._configValues.delete(event.path);
                  });
            }
          }
        }
      }),

      atom.workspace.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.getPath()) {
          cli
            .getConfigFilePath()
            .then(newPath => {
              if (this._configValues.has(newPath)) {
                this.sendSettings(this._configValues.get(
                  newPath,
                ) as IConfigValues);
              } else {
                getConfigValues(newPath)
                  .then(values => {
                    this._configValues.set(newPath, values);
                    this.sendSettings(values);
                  })
                  .catch();
              }
            })
            .catch();
        }
      }),

      atom.commands.add('atom-workspace', {
        'gladiator:generate-files': () =>
          cli.generateFilesToDir(this._insertView),
      }),

      atom.commands.add('atom-workspace', {
        'gladiator:pack-problemset': () => {
          if (this._configValues.size === 1) {
            cli.problemsetPack(
              this._insertView,
              path.dirname(Object.keys(this._configValues)[0]),
            );
          } else {
            cli.problemsetPack(this._insertView);
          }
        },
      }),

      atom.commands.add('atom-workspace', {
        'gladiator:push-problemset': () => {
          cli.problemsetPush(this._insertView);
        },
      }),
    );

    atom.config.set('core.debugLSP', true);

    if (state.serverSettings) {
      this._settings = state.serverSettings;
    }
  }

  public serialize(): IClientState {
    return {
      serverSettings: this._settings,
    };
  }

  public deactivate(): Promise<any> {
    this._subscriptions.dispose();

    return super.deactivate();
  }

  public postInitialization(_server: ActiveServer): void {
    super.postInitialization(_server);

    this._connection = _server.connection;
    cli
      .getConfigFilePath()
      .then(configPath => {
        if (this._configValues.has(configPath)) {
          this.sendSettings(this._configValues.get(
            configPath,
          ) as IConfigValues);
        } else {
          getConfigValues(configPath)
            .then(values => {
              this._configValues.set(configPath, values);
              this.sendSettings(values);
            })
            .catch(() => this.sendSettings({}));
        }
      })
      .catch(() => this.sendSettings({}));
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

  private sendSettings(values: IConfigValues) {
    this._settings.settings.yaml.schemas = {};

    const configSchema = getConfigSchema();
    if (configSchema) {
      this._settings.settings.yaml.schemas[configSchema] = cli.CONFIG_FILE_NAME;
    }

    if (values.problemsetSchema && values.problemsetPath) {
      this._settings.settings.yaml.schemas[values.problemsetSchema] =
        values.problemsetPath;
    }

    if (values.variantSchema && values.variantsPath) {
      this._settings.settings.yaml.schemas[values.variantSchema] =
        values.variantsPath;
    }

    if (this._connection !== null) {
      this._connection.didChangeConfiguration(this._settings);
    }
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
    const connection = new GladiatorConnection(
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
