import {
  AutoLanguageClient,
  ConnectionType,
  LanguageClientConnection,
  LanguageServerProcess,
} from 'atom-languageclient';
import path from 'path';
import { UIpanel } from './ui-panel';

class GladiatorConfClient extends AutoLanguageClient {
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

  public preInitialization(connection: LanguageClientConnection): void {
    connection.onCustom('$/partialResult', () => {});
  }
}

module.exports = new GladiatorConfClient();
const panel = new UIpanel();
panel.createPanel();
