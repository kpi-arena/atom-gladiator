import { TextEditor } from 'atom';
import {
  ActiveServer,
  AutoLanguageClient,
  ConnectionType,
  LanguageClientConnection,
  LanguageServerProcess,
} from 'atom-languageclient';
import path from 'path';
import { UIpanel } from './ui-panel';

class GladiatorConfClient extends AutoLanguageClient {
  private _connection: LanguageClientConnection | null = null;

  constructor() {
    super();
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

  public sendSettings() {
    if (this._connection !== null) {
      this._connection.didChangeConfiguration({
        settings: {
          'yaml': {
            'trace': {
                'server': 'verbose'
            },
            'schemas': {
                'https://arena.kpi.fei.tuke.sk/gladiator/api/v2/utils/schema/problemset-definition': '/*'
            },
            'format': {
                'enable': false,
                'singleQuote': false,
                'bracketSpacing': true,
                'proseWrap': 'preserve'
            },
            'validate': true,
            'hover': true,
            'completion': true,
            'customTags': [],
            'schemaStore': {
                'enable': true
            }
          }
        }
      });
    }
  }

  public sendSchema() {
    let yamlTextEditor: TextEditor | null = null;

    atom.workspace.getTextEditors().forEach(textEditor => {
      if (
        textEditor
          .getRootScopeDescriptor()
          .getScopesArray()
          .includes('source.yaml') ||
        textEditor
          .getRootScopeDescriptor()
          .getScopesArray()
          .includes('source.yml')
      ) {
        yamlTextEditor = textEditor;
        return;
      }
    });
    

    if (yamlTextEditor !== null) {
      this.getConnectionForEditor(yamlTextEditor).then( connection => {
        if (connection !== null) {
          connection.didChangeConfiguration({
            settings: {
              'yaml': {
                'trace': {
                    'server': 'verbose'
                },
                'schemas': {
                    'https://arena.kpi.fei.tuke.sk/gladiator/api/v2/utils/schema/problemset-definition': '/*'
                },
                'format': {
                    'enable': false,
                    'singleQuote': false,
                    'bracketSpacing': true,
                    'proseWrap': 'preserve'
                },
                'validate': true,
                'hover': true,
                'completion': true,
                'customTags': [],
                'schemaStore': {
                    'enable': true
                }
              }
            }
          });
        }
      });
    }
  }

  public preInitialization(connection: LanguageClientConnection): void {
    connection.onCustom('$/partialResult', () => {});
  }

  public postInitialization(_server: ActiveServer): void {
    super.postInitialization(_server);

    this._connection = _server.connection;

    this.sendSettings();
  }
}

const server = new GladiatorConfClient();

module.exports = server;

export default server;

// const panel = new UIpanel();
// panel.createPanel();

// atom.config.set('core.debugLSP', true);
