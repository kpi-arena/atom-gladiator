import * as atomIde from 'atom-ide';
import {
  ActiveServer,
  AutoLanguageClient,
  ConnectionType,
  LanguageClientConnection,
  LanguageServerProcess,
} from 'atom-languageclient';
import path from 'path';

import { Point, TextEditor } from 'atom';
import { IClientState } from './client-state';
import * as lifecycle from './extension-lifecycle';
import { OutlineBuilder } from './outline';
import { getDefaultSettings, IServerSettings } from './server-settings';
import { ArenaPane } from './ui';

export class GladiatorConfClient extends AutoLanguageClient {
  private _connection: LanguageClientConnection | null = null;
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

  public getOutline(editor: TextEditor): Promise<atomIde.Outline | null> {
    // return super.getOutline(editor).then(outlineTree => {
    //   if (outlineTree === null) {
    //     return outlineTree;
    //   }

    //   // let score = 0;
    //   const lines = editor.getBuffer().getLines();

    //   outlineTree.outlineTrees.forEach(tree => {
    //     if (!tree.children) {
    //       return;
    //     }

    //     const score = this.recursiveOutlineSearch(tree, lines);

    //     if (tree.plainText && tree.plainText.match(new RegExp('t'))) {
    //       tree.plainText = tree.plainText + ' (' + score + ')';
    //     } else if (tree.tokenizedText) {
    //       tree.tokenizedText[0].value =
    //         tree.tokenizedText[0].value + ' (' + score + ')';
    //     }
    //   });

    //   console.log('score');
    //   //console.log(score);
    //   console.log(outlineTree);

    //   return outlineTree;
    // });
    const builder = new OutlineBuilder();
    return builder.getOutline(editor);
  }

  // private recursiveOutlineSearch(
  //   tree: atomIde.OutlineTree,
  //   lines: string[],
  // ): number {
  //   const regEx = new RegExp('score( |\t)*:( |\t)*[0-9]*');

  //   let score = 0;

  //   if (regEx.test(lines[tree.startPosition.row])) {
  //     const scoreString = lines[tree.startPosition.row].match(
  //       new RegExp('[0-9]{1,}', 'g'),
  //     );

  //     if (scoreString === null) {
  //       return score;
  //     }

  //     console.log(scoreString);

  //     score = parseInt(scoreString[0], 10);
  //   }

  //   tree.children.forEach(subTree => {
  //     score += this.recursiveOutlineSearch(subTree, lines);
  //   });

  //   const teskRegex = new RegExp('tasks');

  //   if (
  //     tree.tokenizedText !== undefined &&
  //     teskRegex.test(lines[tree.startPosition.row])
  //   ) {
  //     tree.tokenizedText[0].value =
  //       tree.tokenizedText[0].value + ' (' + score + ')';
  //   }

  //   return score;
  // }

  private sendSettings() {
    if (this._connection !== null) {
      this._connection.didChangeConfiguration(this._settings);
    }
  }
}

module.exports = new GladiatorConfClient();
