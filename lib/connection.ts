import { LanguageClientConnection } from 'atom-languageclient';
import { CancellationToken } from 'vscode-jsonrpc';
import {
  CompletionItem,
  CompletionList,
  CompletionParams,
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  DidSaveTextDocumentParams,
  Hover,
  PublishDiagnosticsParams,
  TextDocumentPositionParams,
  TextEdit,
  WillSaveTextDocumentParams,
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

    const relatedUris = doc.relatedUris;

    this._docs.forEach((value, key) => {
      /* Not related anymore. */
      if (relatedUris.indexOf(key) < 0 && doc.uri === value.uri) {
        const unrelatedDoc = doc.getBasicTextDocument(key);

        if (unrelatedDoc) {
          super.didChangeTextDocument({
            contentChanges: [
              {
                text: unrelatedDoc.getText(),
              },
            ],
            textDocument: {
              uri: key,
              version: 0,
            },
          });
        }
      }
    });

    relatedUris.forEach(uri => {
      this._docs.set(uri, doc);
    });

    super.didChangeTextDocument(doc.DidChangeTextDocumentParams);
  }

  public willSaveTextDocument(params: WillSaveTextDocumentParams): void {
    const doc = this._docs.get(params.textDocument.uri);

    if (doc) {
      return super.willSaveTextDocument(
        doc.getwillSaveTextDocumentParams(params),
      );
    }

    return super.willSaveTextDocument(params);
  }

  public willSaveWaitUntilTextDocument(
    params: WillSaveTextDocumentParams,
  ): Promise<TextEdit[] | null> {
    const doc = this._docs.get(params.textDocument.uri);

    if (doc) {
      return super
        .willSaveWaitUntilTextDocument(
          doc.getwillSaveTextDocumentParams(params),
        )
        .then(value => {
          if (!value) {
            return value;
          }

          return doc.transformTextEditArray(value);
        });
    }

    return super.willSaveWaitUntilTextDocument(params);
  }

  public didSaveTextDocument(params: DidSaveTextDocumentParams): void {
    const doc = this._docs.get(params.textDocument.uri);

    if (doc) {
      super.didSaveTextDocument(doc.getDidSaveTextDocumentParams(params));
    } else {
      super.didSaveTextDocument(params);
    }
  }

  // TODO: check how to does this effect the extension.
  public didCloseTextDocument(params: DidCloseTextDocumentParams): void {}

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

  public completion(
    params: TextDocumentPositionParams | CompletionParams,
    cancellationToken?: CancellationToken,
  ): Promise<CompletionItem[] | CompletionList> {
    const doc = this._docs.get(params.textDocument.uri);

    if (doc) {
      return super.completion(
        doc.getCompletionParams(params),
        cancellationToken,
      );
    }

    return super.completion(params, cancellationToken);
  }

  public hover(params: TextDocumentPositionParams): Promise<Hover | null> {
    const doc = this._docs.get(params.textDocument.uri);

    if (doc) {
      return super.hover(doc.getTextDocumentPositionParams(params));
    }

    return super.hover(params);
  }
}
