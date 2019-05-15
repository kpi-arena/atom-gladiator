import { CompositeDisposable, TextEditor } from 'atom';
import {
  ActiveServer,
  AutoLanguageClient,
  ConnectionType,
  LanguageServerProcess,
} from 'atom-languageclient';
import { existsSync } from 'fs';
import * as path from 'path';
import { IClientState } from './client-state';
import * as cli from './gladiator-cli-adapter';
import {
  getConfigSchema,
  getConfigValues,
  IConfigValues,
} from './gladiator-config';
import { GladiatorConnection } from './gladiator-connection';
import { getDefaultSettings } from './server-settings';
import { SpecialDocument } from './special-document';
import CommandPalleteView, { GladiatorStatusView } from './ui';

export class GladiatorConfClient extends AutoLanguageClient {
  private _connection: GladiatorConnection | null = null;
  private _settings = getDefaultSettings();
  private _configPath: string | null = null;
  private _subscriptions = new CompositeDisposable();
  private _insertView = new CommandPalleteView();
  private _statusView: GladiatorStatusView | null = null;

  // @ts-ignore
  public activate(state: IClientState) {
    super.activate();

    if (!cli.isInstalled()) {
      atom.notifications.addFatalError('gladiator-cli is not installed');
    }

    this._subscriptions.add(
      /* Registering file watcher related to .gladiator.yml files. */
      atom.project.onDidChangeFiles(events => {
        for (const event of events) {
          if (event.path.match(cli.CONFIG_FILE_REGEX)) {
            this.findAndSetConfig();
          }
        }
      }),

      atom.workspace.onDidChangeActiveTextEditor(editor => {
        this.findAndSetConfig();
      }),

      atom.commands.add('atom-workspace', {
        'gladiator:generate-files': () =>
          cli.generateFilesToDir(this._insertView),
      }),

      atom.commands.add('atom-workspace', {
        'gladiator:pack-problemset': () => {
          if (this._configPath) {
            cli.problemsetPack(
              this._insertView,
              path.dirname(this._configPath),
            );
          } else {
            cli.problemsetPack(this._insertView);
          }
        },
      }),

      atom.commands.add('atom-workspace', {
        'gladiator:push-problemset': () => {
          if (this._configPath) {
            cli.problemsetPush(
              this._insertView,
              path.dirname(this._configPath),
            );
          } else {
            cli.problemsetPush(this._insertView);
          }
        },
      }),

      atom.commands.add('atom-workspace', {
        'gladiator:docker-image-pack': () => {
          if (this._configPath) {
            cli.dockerImagePack(path.dirname(this._configPath));
          } else {
            cli.dockerImagePack();
          }
        },
      }),

      atom.commands.add('atom-workspace', {
        'gladiator:docker-image-build': () => {
          if (this._configPath) {
            cli.dockerImageBuild(path.dirname(this._configPath));
          } else {
            cli.dockerImageBuild();
          }
        },
      }),
    );

    atom.config.set('core.debugLSP', false);

    if (state.serverSettings) {
      this._settings = state.serverSettings;
    }
  }

  public consumeStatusBar(statusBar: any) {
    this._statusView = new GladiatorStatusView(statusBar);
    this.updateStatusBar();
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

    this._connection = _server.connection as GladiatorConnection;

    this.findAndSetConfig();
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

  private findAndSetConfig(): void {
    const editorPath = atom.workspace.getActiveTextEditor()
      ? (atom.workspace.getActiveTextEditor() as TextEditor).getPath()
      : null;

    if (!editorPath) {
      /* Nothing is open. */
      this.unsetValues();
    } else if (
      this._connection &&
      this._connection.isRelated(editorPath) &&
      this._configPath
    ) {
      /* Opened an related doc. */
      if (existsSync(this._configPath)) {
        getConfigValues(this._configPath)
          .then(values => this.setValues(values, this._configPath as string))
          .catch(() => this.unsetValues());
      } else {
        this.findAndSetConfig();
      }
    } else if (this._connection) {
      cli
        .getConfigFilePath(true)
        .then(confPath => {
          getConfigValues(confPath)
            .then(values => this.setValues(values, confPath))
            .catch(() => this.unsetValues());
        })
        .catch(() => this.unsetValues());
    } else {
      this.unsetValues();
    }
  }

  private unsetValues() {
    this._configPath = null;

    if (this._statusView) {
      this._statusView.update(false);
    }

    if (this._connection) {
      this._connection.deleteSpecialDocs();
      this._connection.formatSubPath = null;
    }

    this.sendSettings({});
  }

  private setValues(values: IConfigValues, newPath: string) {
    console.log(values);
    this._configPath = newPath;

    if (this._statusView) {
      this._statusView.update(true, newPath);
    }

    if (this._connection) {
      this._connection.formatSubPath = path.dirname(newPath);
    }

    this.setFiles(values, newPath);

    this.sendSettings(values);
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

    if (this._connection) {
      this._connection.didChangeConfiguration(this._settings);
    }
  }

  private setFiles(values: IConfigValues, configPath: string) {
    if (this._connection) {
      this._connection.deleteSpecialDocs();

      if (values.problemsetPath) {
        this._connection.addSpecialDoc(
          new SpecialDocument(
            path.join(path.dirname(configPath), values.problemsetPath),
          ),
          true,
        );
      }

      if (values.variantsPath) {
        this._connection.addSpecialDoc(
          new SpecialDocument(
            path.join(path.dirname(configPath), values.variantsPath),
          ),
          false,
        );
      }
    }
  }

  private updateStatusBar(rootpath?: string) {
    if (rootpath && this._statusView) {
      this._statusView.update(true, rootpath);
    } else if (this._statusView) {
      this._statusView.update(false);
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
    // @ts-ignore
    this.preInitialization(connection);
    const initializeParams = this.getInitializeParams(projectPath, process);
    // @ts-ignore
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
    // @ts-ignore
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
    // @ts-ignore
    return newServer;
  };
}

module.exports = new GladiatorConfClient();
