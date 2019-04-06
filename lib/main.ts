import * as atomIde from 'atom-ide';
import {
  ActiveServer,
  AutoLanguageClient,
  ConnectionType,
  Convert,
  LanguageClientConnection,
  LanguageServerProcess,
} from 'atom-languageclient';
import * as ac from 'atom/autocomplete-plus';
import path from 'path';
import * as fs from 'fs';

import { CompositeDisposable, Point, TextEditor } from 'atom';
import { Position, TextDocument } from 'vscode-languageserver-types';
import { IClientState } from './client-state';
import { SuperConnection } from './connection';
import { SuperDocument } from './document-manager';
import * as lifecycle from './extension-lifecycle';
import { OutlineBuilder } from './outline';
import { getDefaultSettings, IServerSettings } from './server-settings';
import { ArenaPane } from './ui';

export class GladiatorConfClient extends AutoLanguageClient {
  private _connection: LanguageClientConnection | null = null;
  private _outlineBuilder = new OutlineBuilder();
  private _pane = new ArenaPane(this);
  private _settings = getDefaultSettings();

  // @ts-ignore
  public activate(state: IClientState) {
    super.activate();

    atom.config.set('core.debugLSP', true);

    if (state.serverSettings) {
      this._settings = state.serverSettings;
    }

    if (state.isPaneActive) {
      this._pane.show();
    }

    lifecycle.activate(this._pane);
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

  public sendSchema(schema: string) {
    if (schema.length === 0) {
      return;
    }

    this._settings.settings.yaml.schemas = {
      [schema]: '/*',
    };

    this.sendSettings();
  }

  protected getOutline(editor: TextEditor): Promise<atomIde.Outline | null> {
    return this._outlineBuilder.getOutline(editor);
  }

  // protected getSuggestions(
  //   request: ac.SuggestionsRequestedEvent,
  // ): Promise<ac.AnySuggestion[]> {
  //   return new Promise((resolve, reject) => {
  //     // const res: ac.AnySuggestion[] = [{ text: 'yeah' }, { text: 'boi' }];

  //     if (this._connection !== null) {
  //       this._connection.completion({
  //         textDocument: Convert.editorToTextDocumentIdentifier(request.editor),
  //         position: Convert.pointToPosition(request.bufferPosition),
  //         context:
  //       });
  //     }

  //     resolve(res);
  //   });
  // }

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
}

module.exports = new GladiatorConfClient();
