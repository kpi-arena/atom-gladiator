import { Convert, LanguageClientConnection } from 'atom-languageclient';
import { CancellationToken } from 'vscode-jsonrpc';
import {
  CompletionItem,
  CompletionList,
  CompletionParams,
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  DidSaveTextDocumentParams,
  DocumentSymbol,
  DocumentSymbolParams,
  Hover,
  PublishDiagnosticsParams,
  SymbolInformation,
  TextDocument,
  TextDocumentPositionParams,
  TextEdit,
  WillSaveTextDocumentParams,
} from 'vscode-languageserver-protocol';
import { safeLoad } from 'yaml-ast-parser';
import { SuperDocument } from './document-manager';
import { FormatValidation } from './format-schema';
import { ScoreOutline } from './outline';

export class SuperConnection extends LanguageClientConnection {
  /* Mapping URIs to their SuperDocuments. Key is an URI and the value is an
  SuperDocument with all the includes resolved. */
  private _docs: Map<string, SuperDocument> = new Map();
  /* Mapping URIs to their current version. Key: URI, value: version number. */
  private _versions: Map<string, number> = new Map();

  private _format: Map<string, FormatValidation> = new Map();

  private _singleFileDocs: Map<string, TextDocument> = new Map();

  public addFormat(uri: string, format: FormatValidation) {
    this._format.set(uri, format);
  }

  /* Only calls super method, if the doc wasn't opened direcly/via include ref.
  Otherwise Atom has the diagnostics already in the memory thanks to other doc. */
  public didOpenTextDocument(params: DidOpenTextDocumentParams): void {
    /* If doc wasn't open yet, creating new SuperDocument from params. */
    if (!this._docs.has(params.textDocument.uri)) {
      const doc = new SuperDocument(
        params.textDocument.text,
        params.textDocument.uri,
        params.textDocument.version,
      );

      /* Assigning SuperDocument and initial version to all subdocuments. */
      doc.relatedUris.forEach(uri => {
        this._docs.set(uri, doc);
        this._versions.set(uri, params.textDocument.version);
      });

      this._singleFileDocs = doc.subDocuments;

      super.didOpenTextDocument(doc.DidOpenTextDocumentParams);
    }
  }

  public didChangeTextDocument(params: DidChangeTextDocumentParams): void {
    let docVersion = this._versions.get(params.textDocument.uri);
    /* Increasing version number of all related docs. */
    if (docVersion) {
      docVersion++;

      for (const key of this._versions.keys()) {
        if (key === params.textDocument.uri) {
          this._versions.set(key, docVersion);
        }
      }
    }

    const doc = new SuperDocument(
      params.contentChanges[0].text,
      params.textDocument.uri,
      docVersion ? docVersion : 1,
    );

    const relatedUris = doc.relatedUris;
    this._singleFileDocs = doc.subDocuments;

    this._docs.forEach((value, key) => {
      /* If doc was related before, but now it's not, it's need to send to the
      server to get the correct diagnostics for it. */
      if (relatedUris.indexOf(key) < 0 && doc.uri === value.uri) {
        const unrelatedDoc = SuperDocument.getBasicTextDocument(
          Convert.uriToPath(key),
        );

        if (unrelatedDoc) {
          super.didChangeTextDocument({
            contentChanges: [
              {
                text: unrelatedDoc.getText(),
              },
            ],
            textDocument: {
              uri: key,
              /* Version needs to be atleast = 1, otherwise server will ignore it */
              version: docVersion ? docVersion : 1,
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

  public didCloseTextDocument(params: DidCloseTextDocumentParams): void {
    // TODO: check how to does this effect the extension.
  }

  public onPublishDiagnostics(
    callback: (params: PublishDiagnosticsParams) => void,
  ): void {
    const newCallback = (params: PublishDiagnosticsParams) => {
      if (
        this._format.has(params.uri) &&
        this._singleFileDocs.has(params.uri)
      ) {
        const singleDoc = this._singleFileDocs.get(params.uri) as TextDocument;
        const format = this._format.get(params.uri) as FormatValidation;

        format.doc = singleDoc;

        params.diagnostics = params.diagnostics.concat(
          format.getDiagnostics(safeLoad(singleDoc.getText())),
        );
      }

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

  public documentSymbol(
    params: DocumentSymbolParams,
    cancellationToken?: CancellationToken,
  ): Promise<SymbolInformation[] | DocumentSymbol[]> {
    // const doc = this._singleFileDocs.get(params.textDocument.uri);
    const doc = this._docs.get(params.textDocument.uri);
    if (doc) {
      return new Promise(resolve => {
        // const outline = new SingleFileOutline(doc);
        const outline = new ScoreOutline(doc);
        const res = outline.parseFile();
        resolve(res);
      });
    }

    return super.documentSymbol(params, cancellationToken);
  }
}
