import { LanguageClientConnection } from 'atom-languageclient';
import * as lsp from 'vscode-languageserver-protocol';
import { SuperDocument } from './document-manager';

export class SuperConnection extends LanguageClientConnection {
  private _docs: Map<string, SuperDocument> = new Map();

  public didOpenTextDocument(params: lsp.DidOpenTextDocumentParams): void {
    const doc = new SuperDocument(params);
    doc.buildRequest(params);
    super.didOpenTextDocument(params);

    // this._docs.set(doc.request.textDocument.uri, doc);
  }

  public onPublishDiagnostics(
    callback: (params: lsp.PublishDiagnosticsParams) => void,
  ): void {
    const newCallback = (params: lsp.PublishDiagnosticsParams) => {
      const doc = this._docs.get(params.uri);
      let filteredParams = params;

      if (doc) {
        filteredParams = doc.filterAnswer(params);
      }

      callback(filteredParams);
    };

    super.onPublishDiagnostics(newCallback);
  }
}
