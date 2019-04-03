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

import { Point, TextEditor } from 'atom';
import { IClientState } from './client-state';
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

    atom.config.set('core.debugLSP', false);

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

  public startServerProcess(): LanguageServerProcess {
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
}

module.exports = new GladiatorConfClient();
