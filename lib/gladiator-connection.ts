import { Convert, LanguageClientConnection, Logger } from 'atom-languageclient';
import { dirname } from 'path';
import { MessageConnection } from 'vscode-jsonrpc';
import {
  CancellationToken,
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
  TextDocumentPositionParams,
  TextEdit,
  WillSaveTextDocumentParams,
} from 'vscode-languageserver-protocol';
import { safeLoad } from 'yaml-ast-parser';
import { FormatValidation } from './format-schema';
import { CONFIG_FILE_REGEX, getGladiatorFormat } from './gladiator-cli-adapter';
import { ScoreOutline, SingleFileOutline } from './outline';
import { SpecialDocument } from './special-document';
import { getOpenYAMLDocuments } from './util';

export class GladiatorConnection extends LanguageClientConnection {
  private _docs: Map<string, SpecialDocument> = new Map();
  private _versions: Map<SpecialDocument, number> = new Map();
  private _format: FormatValidation | null = null;
  private _scoreDocs: Map<string, ScoreOutline | null> = new Map();

  constructor(rpc: MessageConnection, logger?: Logger) {
    super(rpc, logger);

    getGladiatorFormat()
      .then(value => {
        this._format = new FormatValidation(safeLoad(value));
      })
      .catch(() => {
        this._format = null;
      });
  }

  public addSpecialDoc(doc: SpecialDocument, hasScore: boolean) {
    doc.relatedUris.forEach(relatedUri => {
      this._docs.set(relatedUri, doc);
    });

    if (hasScore) {
      this._scoreDocs.set(doc.rootPath, null);
    }

    this._versions.set(doc, 0);

    super.didOpenTextDocument(doc.getDidOpen());
  }

  public isRelated(pathToCheck: string): boolean {
    let result = false;

    const uriToCheck = Convert.pathToUri(pathToCheck);

    for (const uri of this._docs.keys()) {
      if (uri === uriToCheck) {
        result = true;
      }
    }

    return result;
  }

  public set formatSubPath(subPath: string | null) {
    if (subPath && this._format) {
      (this._format as FormatValidation).subPath = subPath;
    }
  }

  public deleteSpecialDocs() {
    this._docs.forEach(doc => {
      super.didCloseTextDocument(doc.getDidClose());
    });

    this._docs = new Map();
    this._versions = new Map();
    this._scoreDocs = new Map();
  }

  public didOpenTextDocument(params: DidOpenTextDocumentParams): void {
    if (!this._docs.has(params.textDocument.uri)) {
      super.didOpenTextDocument(params);
    }
  }

  public didChangeTextDocument(params: DidChangeTextDocumentParams): void {
    if (this._docs.has(params.textDocument.uri)) {
      const doc = this._docs.get(params.textDocument.uri) as SpecialDocument;

      /* Calculating new version number and deleting the previous doc. */
      const version = (this._versions.get(doc) as number) + 1;
      this._versions.delete(doc);

      for (const uri of this._docs.keys()) {
        if ((this._docs.get(uri) as SpecialDocument) === doc) {
          this._docs.delete(uri);
        }
      }

      const newDoc = new SpecialDocument(doc.rootPath);

      newDoc.relatedUris.forEach(relatedUri =>
        this._docs.set(relatedUri, newDoc),
      );

      this._versions.set(newDoc, version);

      if (this._scoreDocs.has(doc.rootPath)) {
        this._scoreDocs.set(doc.rootPath, null);
      }

      super.didChangeTextDocument(newDoc.getDidChange(version));
    } else {
      super.didChangeTextDocument(params);
    }
  }

  public willSaveTextDocument(params: WillSaveTextDocumentParams): void {
    if (this._docs.has(params.textDocument.uri)) {
      return super.willSaveTextDocument(
        (this._docs.get(
          params.textDocument.uri,
        ) as SpecialDocument).getwillSave(params),
      );
    } else {
      return super.willSaveTextDocument(params);
    }
  }

  public willSaveWaitUntilTextDocument(
    params: WillSaveTextDocumentParams,
  ): Promise<TextEdit[] | null> {
    if (this._docs.has(params.textDocument.uri)) {
      const doc = this._docs.get(params.textDocument.uri) as SpecialDocument;

      return super
        .willSaveWaitUntilTextDocument(doc.getwillSave(params))
        .then(value => {
          if (!value) {
            return value;
          }

          return doc.transformTextEditArray(value);
        });
    } else {
      return super.willSaveWaitUntilTextDocument(params);
    }
  }

  public didSaveTextDocument(params: DidSaveTextDocumentParams): void {
    if (this._docs.has(params.textDocument.uri)) {
      super.didSaveTextDocument(
        (this._docs.get(params.textDocument.uri) as SpecialDocument).getDidSave(
          params,
        ),
      );
    } else {
      super.didSaveTextDocument(params);
    }
  }

  public didCloseTextDocument(params: DidCloseTextDocumentParams): void {
    if (!this._docs.has(params.textDocument.uri)) {
      super.didCloseTextDocument(params);
    }
  }

  public onPublishDiagnostics(
    callback: (params: PublishDiagnosticsParams) => void,
  ): void {
    const newCallback = (params: PublishDiagnosticsParams) => {
      const paramsPath = Convert.uriToPath(params.uri);

      if (this._format && paramsPath.match(CONFIG_FILE_REGEX)) {
        const formatDoc = getOpenYAMLDocuments().get(paramsPath);

        if (formatDoc) {
          this._format.subPath = dirname(paramsPath);

          params.diagnostics = params.diagnostics.concat(
            this._format.getDiagnostics(
              safeLoad(formatDoc.getText()),
              formatDoc,
            ),
          );
        }

        callback(params);
      } else if (this._docs.has(params.uri)) {
        (this._docs.get(params.uri) as SpecialDocument)
          .filterDiagnostics(params)
          .forEach(filteredParams => {
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
    if (this._docs.has(params.textDocument.uri)) {
      return super.hover(
        (this._docs.get(
          params.textDocument.uri,
        ) as SpecialDocument).getTextDocumentPositionParams(params),
      );
    } else {
      return super.hover(params);
    }
  }

  public documentSymbol(
    params: DocumentSymbolParams,
    cancellationToken?: CancellationToken,
  ): Promise<SymbolInformation[] | DocumentSymbol[]> {
    const specDoc = this._docs.get(params.textDocument.uri);

    if (specDoc && this._scoreDocs.has(specDoc.rootPath)) {
      return new Promise(resolve => {
        let score = this._scoreDocs.get(specDoc.rootPath);

        if (!score) {
          score = new ScoreOutline(specDoc);
          this._scoreDocs.set(specDoc.rootPath, score);
        }
        resolve(score.getOutline(params.textDocument.uri));
      });
    }

    const doc = getOpenYAMLDocuments().get(
      Convert.uriToPath(params.textDocument.uri),
    );

    if (doc) {
      return new Promise(resolve => {
        resolve(new SingleFileOutline(doc).getOutline());
      });
    } else {
      return super.documentSymbol(params, cancellationToken);
    }
  }
}
