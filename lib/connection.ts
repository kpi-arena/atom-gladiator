import { LanguageClientConnection } from 'atom-languageclient';
import * as lsp from 'vscode-languageserver-protocol';

export class SuperConnection extends LanguageClientConnection {
  public didOpenTextDocument(params: lsp.DidOpenTextDocumentParams): void {
    console.log(params);
    super.didOpenTextDocument(params);
  }
}
