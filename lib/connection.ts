import { LanguageClientConnection } from 'atom-languageclient';
import { SuperDocument } from './document-manager';

export class SuperConnection extends LanguageClientConnection {
  private _docs: Map<string, SuperDocument> = new Map();

  // public didOpenTextDocument(params: lsp.DidOpenTextDocumentParams): void {
  //   const doc = new SuperDocument(params);
  //   doc.test();
  //   super.didOpenTextDocument(doc.DidOpenTextDocumentParams);

  //   this._docs.set(doc.DidOpenTextDocumentParams.textDocument.uri, doc);
  // }

  // public onPublishDiagnostics(
  //   callback: (params: lsp.PublishDiagnosticsParams) => void,
  // ): void {
  //   const newCallback = (params: lsp.PublishDiagnosticsParams) => {
  //     console.log(params);
  //     const doc = this._docs.get(params.uri);
  //     let filteredParams = params;

  //     if (doc) {
  //       filteredParams = doc.filterDiagnostics(params);
  //     }
  //     console.log(filteredParams);
  //     callback(filteredParams);
  //   };

  //   super.onPublishDiagnostics(newCallback);
  // }
}
