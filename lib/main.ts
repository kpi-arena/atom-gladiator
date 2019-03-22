import path from 'path';
import {
  AutoLanguageClient,
  ConnectionType,
  LanguageServerProcess,
  LanguageClientConnection,
} from 'atom-languageclient';

class GladiatorConfClient extends AutoLanguageClient {
  constructor() {
    super();
  }

  getGrammarScopes(): string[] {
    return ['source.yaml', 'source.yml'];
  }

  getLanguageName(): string {
    return 'YAML';
  }

  getServerName(): string {
      return 'YAML lint';
  }

  getConnectionType(): ConnectionType {
    return 'stdio';
  }

  startServerProcess(): LanguageServerProcess {
    return super.spawnChildNode([
      path.join(
        __dirname,
        '../node_modules/yaml-language-server/out/server/src/server.js',
      ),
      '--stdio',
    ]) as LanguageServerProcess;
  }

  preInitialization(connection: LanguageClientConnection): void {
      connection.onCustom('$/partialResult', () => {});
  }
}

module.exports = new GladiatorConfClient
