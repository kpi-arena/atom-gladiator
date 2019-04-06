import { LanguageClientConnection } from 'atom-languageclient';
import * as lsp from 'vscode-languageserver-protocol';
import { SuperDocument } from './document-manager';
import { request } from 'http';

export class SuperConnection extends LanguageClientConnection {
  public didOpenTextDocument(params: lsp.DidOpenTextDocumentParams): void {
    const test = new SuperDocument();
    console.log(test.didOpen(params));

    super.didOpenTextDocument(params);
  }
}
