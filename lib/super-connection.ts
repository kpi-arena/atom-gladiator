import { Convert, LanguageClientConnection, Logger } from 'atom-languageclient';
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
import { SingleFileOutline } from './outline';
import { SpecialDocument } from './special-document';
import { getOpenYAMLDocuments } from './util';

export class GladiatorConnection extends LanguageClientConnection {
  private _docs: Map<string, SpecialDocument> = new Map();
  private _versions: Map<SpecialDocument, number> = new Map();
  private _format: FormatValidation | null = null;

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

  public addSpecialDoc(doc: SpecialDocument) {
    this._docs = doc.relatedPaths;
    this._versions.set(doc, 0);
    super.didOpenTextDocument(doc.getDidOpen());
  }

  public set format(format: FormatValidation | null) {
    this._format = format;
  }

  public deteleSpecialDocs() {
    this._docs.forEach(doc => {
      super.didCloseTextDocument(doc.getDidClose());
    });

    this._docs = new Map();
    this._versions = new Map();
  }

  public didOpenTextDocument(params: DidOpenTextDocumentParams): void {
    if (!this._docs.has(params.textDocument.uri)) {
      super.didOpenTextDocument(params);
    }
  }

  public didChangeTextDocument(params: DidChangeTextDocumentParams): void {
    if (this._docs.has(params.textDocument.uri)) {
      const doc = this._docs.get(params.textDocument.uri) as SpecialDocument;

      const version = (this._versions.get(doc) as number) + 1;
      this._versions.delete(doc);

      const newDoc = new SpecialDocument(doc.rootPath);
      this._docs = newDoc.relatedPaths;

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
      if (this._format && params.uri.match(CONFIG_FILE_REGEX)) {
        const formatDoc = getOpenYAMLDocuments().get(
          Convert.pathToUri(params.uri),
        );

        if (formatDoc) {
          params.diagnostics = params.diagnostics.concat(
            this._format.getDiagnostics(safeLoad(formatDoc.getText())),
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
    const doc = getOpenYAMLDocuments().get(
      Convert.pathToUri(params.textDocument.uri),
    );

    if (doc) {
      return new Promise(resolve => {
        const outline = new SingleFileOutline(doc);
        // const outline = new ScoreOutline(doc);
        const res = outline.parseFile();
        resolve(res);
      });
    }
    if (doc) {
      return new Promise(resolve => {
        const outline = new SingleFileOutline(doc);
        // const outline = new ScoreOutline(doc);
        const res = outline.parseFile();
        resolve(res);
      });
    } else {
      return super.documentSymbol(params, cancellationToken);
    }
  }
}
