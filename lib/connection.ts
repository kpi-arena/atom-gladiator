import { LanguageClientConnection } from 'atom-languageclient';
import * as lsp from 'vscode-languageserver-protocol';
import { SuperDocument } from './document-manager';

export class SuperConnection extends LanguageClientConnection {
  public didOpenTextDocument(params: lsp.DidOpenTextDocumentParams): void {
    const test = new SuperDocument();
    console.log(test.getSuperDoc(params));

    super.didOpenTextDocument(params);
  }
}
