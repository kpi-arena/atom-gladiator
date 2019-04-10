import { LanguageClientConnection } from 'atom-languageclient';
import {
  DidChangeTextDocumentParams,
  DidOpenTextDocumentParams,
  PublishDiagnosticsParams,
} from 'vscode-languageserver-protocol';
import { SuperDocument } from './document-manager';

export class SuperConnection extends LanguageClientConnection {
  private _docs: Map<string, SuperDocument> = new Map();

  public didOpenTextDocument(params: DidOpenTextDocumentParams): void {
    if (!this._docs.has(params.textDocument.uri)) {
      const doc = new SuperDocument(
        params.textDocument.text,
        params.textDocument.uri,
        params.textDocument.version,
      );

      doc.relatedUris.forEach(uri => {
        this._docs.set(uri, doc);
      });

      super.didOpenTextDocument(doc.DidOpenTextDocumentParams);
    }
  }

  public didChangeTextDocument(params: DidChangeTextDocumentParams): void {
    const doc = new SuperDocument(
      params.contentChanges[0].text,
      params.textDocument.uri,
      params.textDocument.version ? params.textDocument.version : 0,
    );

    doc.relatedUris.forEach(uri => {
      this._docs.set(uri, doc);
    });

    super.didChangeTextDocument(doc.DidChangeTextDocumentParams);
  }

  public onPublishDiagnostics(
    callback: (params: PublishDiagnosticsParams) => void,
  ): void {
    const newCallback = (params: PublishDiagnosticsParams) => {
      const doc = this._docs.get(params.uri);

      if (doc) {
        doc.filterDiagnostics(params).forEach(filteredParams => {
          callback(filteredParams);
        });
      } else {
        callback(params);
      }
    };

    super.onPublishDiagnostics(newCallback);
  }
}
