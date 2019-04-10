import { LanguageClientConnection } from 'atom-languageclient';
import {
  DidOpenTextDocumentParams,
  PublishDiagnosticsParams,
} from 'vscode-languageserver-protocol';
import { SuperDocument } from './document-manager';

export class SuperConnection extends LanguageClientConnection {
  private _docs: Map<string, SuperDocument> = new Map();

  public didOpenTextDocument(params: DidOpenTextDocumentParams): void {
    const doc = new SuperDocument(params);

    doc.relatedUris.forEach(uri => {
      this._docs.set(uri, doc);
    });

    super.didOpenTextDocument(doc.DidOpenTextDocumentParams);
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
