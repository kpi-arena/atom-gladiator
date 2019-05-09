import { Convert } from 'atom-languageclient';
import * as path from 'path';
import {
  CompletionParams,
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  DidSaveTextDocumentParams,
  Position,
  PublishDiagnosticsParams,
  Range,
  TextDocument,
  TextDocumentPositionParams,
  TextEdit,
  WillSaveTextDocumentParams,
} from 'vscode-languageserver-protocol';
import { IncludeError } from './include-error';
import {
  getBasicTextDocument,
  getOpenYAMLDocuments,
  LANGUAGE_ID,
} from './util';

/**
 * Represents relation between an original line in document given by URI and
 * new line in the super document. Intendation
 */
export interface ILinesRelation {
  /* Line in the super document. */
  newLine: number;

  /* Line in the original document. */
  originLine: number;

  /* URI of the original document. */
  originUri: string;

  /* Path of the original document. */
  originPath: string;

  /* Global length of indendation of the original document, not just related
  to it's parent documents. */
  intendationLength: number;
}

export class SpecialDocument {
  private readonly INCLUDE_REGEX = /^(\cI|\t|\x20)*(#include ((\.|\\|\/|\w|-)+(\.yaml|\.yml)))(\cI|\t|\x20)*/;

  private _relatedUris: Map<string, SpecialDocument> = new Map();
  private _newToOld: ILinesRelation[] = [];
  private _oldToNew: Map<number, ILinesRelation[]> = new Map();
  private _includeErrors: IncludeError[] = [];
  private _content: string;

  constructor(private _rootPath: string) {
    const editorDocs = getOpenYAMLDocuments();

    this._content = this.buildDocument('', _rootPath, '', editorDocs, []);
  }

  public get relatedPaths(): Map<string, SpecialDocument> {
    return this._relatedUris;
  }

  public get rootPath(): string {
    return this._rootPath;
  }

  /**
   * Used when the document, or any of the subdocuments is opened. The params
   * are in context of the whole document, so diagnostics are returned for all
   * retlated files - use `filterDiagnostics` for filter them.
   */
  public getDidOpen(): DidOpenTextDocumentParams {
    return {
      textDocument: {
        languageId: LANGUAGE_ID,
        text: this._content,
        uri: Convert.pathToUri(this._rootPath),
        version: 0,
      },
    };
  }

  public getDidChange(docVer: number): DidChangeTextDocumentParams {
    return {
      contentChanges: [{ text: this._content }],
      textDocument: {
        uri: Convert.pathToUri(this._rootPath),
        version: docVer,
      },
    };
  }

  public getwillSave(
    params: WillSaveTextDocumentParams,
  ): WillSaveTextDocumentParams {
    return {
      textDocument: {
        uri: Convert.pathToUri(this._rootPath),
      },
      reason: params.reason,
    };
  }

  /** Used when the document is saved. */
  public getDidSave(
    params: DidSaveTextDocumentParams,
  ): DidSaveTextDocumentParams {
    return {
      text: params.text,
      textDocument: {
        uri: Convert.pathToUri(this._rootPath),
        version: params.textDocument.version,
      },
    };
  }

  public getDidClose(): DidCloseTextDocumentParams {
    return {
      textDocument: {
        uri: Convert.pathToUri(this._rootPath),
      },
    };
  }

  /**
   * Transforms params of the request to match their context in the curent
   * super document.
   *
   * @param params - parameters which have to be transformed.
   */
  public getCompletionParams(
    params: TextDocumentPositionParams | CompletionParams,
  ): CompletionParams {
    const result = this.getTextDocumentPositionParams(params);

    /* If 'params' are instance of CompletionParams add 'context' to the result. */
    if (this.instanceOfCompletionParams(params)) {
      (result as CompletionParams).context = params.context;
    }

    return result;
  }

  /**
   * Transforms the document's position to it's true position in the super
   * document, adds intendation of the document to the character position and
   * changes it's URI to to the URI of the root document.
   *
   * @param params - parameters sent from client containing positions and URI
   * of the original doc.
   */
  public getTextDocumentPositionParams(
    params: TextDocumentPositionParams,
  ): TextDocumentPositionParams {
    const lineRelation = this._oldToNew.get(params.position.line);

    if (lineRelation) {
      /* Iterating through 'ILinesRelation' array, in which each 'originalLine'
      is equal to the line from params. Only URI needs to be checked and when
      the corresponding one is found, position is changed according to the new
      position. Note: for-of is not used, since we want to return value from
      the loop directly. */
      for (let index = 0; index < lineRelation.length; index++) {
        if (lineRelation[index].originUri === params.textDocument.uri) {
          params.position.line = lineRelation[index].newLine;
          params.position.character += lineRelation[index].intendationLength;

          params.textDocument.uri = Convert.pathToUri(this._rootPath);

          return params;
        }
      }
    }

    return params;
  }

  /**
   * Divides `params` into Map, in which the key is equal to the URI of the
   * original document and the value is a PublishDiagnosticsParams with tran-
   * slated document positions.
   *
   * @param params - all diagnostics for a super document.
   */
  public filterDiagnostics(
    params: PublishDiagnosticsParams,
  ): Map<string, PublishDiagnosticsParams> {
    const result: Map<string, PublishDiagnosticsParams> = new Map();

    /* Initialize Map for each related subdocument with it's relatedUri as a
    key. Skipping this steps results in Diagnostics not clearing from editor
    if each Diagnostic is fixed by user. */
    for (const relatedUri of this._relatedUris.keys()) {
      result.set(relatedUri, {
        uri: relatedUri,
        version: params.version,
        diagnostics: [],
      });
    }

    params.diagnostics.forEach(diagnose => {
      const startRelation = this._newToOld[diagnose.range.start.line];

      /* Push diagnostic of a document to diagnostics[] of the corresponding
      document, which is determined by URI. Also the range of the diagnostic
      are transformed to correspond with the original document's positions. */
      (result.get(
        startRelation.originUri,
      ) as PublishDiagnosticsParams).diagnostics.push({
        code: diagnose.code,
        message: diagnose.message,
        range: this.transformRange(diagnose.range),
        relatedInformation: diagnose.relatedInformation,
        severity: diagnose.severity,
        source: diagnose.source,
      });
    });

    /* Push reference errors into diagnostics of the corresponding document. */
    this._includeErrors.forEach(err => {
      const correspondingDiagnostics = result.get(err.uri);

      if (correspondingDiagnostics) {
        correspondingDiagnostics.diagnostics.push(err.diagnostic);
      }
    });

    return result;
  }

  /**
   * Transforms Range in every entry of `edits` to correspong to the actual
   * Range in original document.
   *
   * @param edits - array in which Range is transformed.
   */
  public transformTextEditArray(edits: TextEdit[]): TextEdit[] {
    edits.forEach(edit => {
      edit.range = this.transformRange(edit.range);
    });

    return edits;
  }

  /**
   * Transforms `superRange` from the super document to range in the one of
   * it's subdocuments. If the range ends outside of the subdocument, it's end
   * is set to the end of the subdocument. Transform also the intendation.
   *
   * @param superRange - range in the super document.
   */
  public transformRange(superRange: Range): Range {
    const startRelation = this._newToOld[superRange.start.line];

    let endRelation = this._newToOld[superRange.start.line];

    /* Going through '_newRelation' until the end of the super document is
    reacher, or the next line is not from the subdocument or the end line is
    found. */
    while (
      endRelation.newLine + 1 < this._newToOld.length &&
      this._newToOld[endRelation.newLine + 1].originUri ===
        startRelation.originUri &&
      superRange.end.line !== endRelation.newLine
    ) {
      endRelation = this._newToOld[endRelation.newLine + 1];
    }

    /* When returning the corresponding range, indendation is substracted. */
    return {
      start: {
        line: startRelation.originLine,
        character: superRange.start.character - startRelation.intendationLength,
      },
      end: {
        line: endRelation.originLine,
        character: superRange.end.character - endRelation.intendationLength,
      },
    };
  }

  private buildDocument(
    newContent: string,
    docPath: string,
    intendation: string,
    editorDocs: Map<string, TextDocument>,
    pathStack: string[],
  ): string {
    const doc = getBasicTextDocument(docPath, editorDocs);

    if (!doc) {
      throw new Error();
    }

    /* Checking if the file is already in stack, in case it is throw an error. */
    if (pathStack.indexOf(docPath) > -1) {
      throw new Error('i');
    }

    pathStack.push(docPath);

    this._relatedUris.set(Convert.pathToUri(docPath), this);

    /* Using @ts-ignore to ignore the error, caused by accessing private method
    to obtain line offsets od the document. */
    // @ts-ignore
    const docOffsets: number[] = doc.getLineOffsets();

    for (let index = 0; index < docOffsets.length; index++) {
      let docLine: string;

      /* Get line from doc between two offsets. In case of the last line of the
      doc, method positionAt() cannot be used, so we get a string between the 
      lat line offset and doc length. */
      if (index === docOffsets.length - 1) {
        docLine = doc.getText({
          start: doc.positionAt(docOffsets[index]),
          end: doc.positionAt(doc.getText().length),
        });
      } else {
        docLine = doc.getText({
          start: doc.positionAt(docOffsets[index]),
          end: doc.positionAt(docOffsets[index + 1]),
        });
      }

      const newLineRelation = {
        newLine: this._newToOld.length,
        originLine: index,
        originUri: Convert.pathToUri(docPath),
        originPath: docPath,
        intendationLength: intendation.length,
      };

      if (this._oldToNew.has(index)) {
        (this._oldToNew.get(index) as ILinesRelation[]).push(newLineRelation);
      } else {
        this._oldToNew.set(index, [newLineRelation]);
      }

      this._newToOld.push(newLineRelation);

      /* Checking if the line contains #include statement, in case it does
      recursively call buildDoc(). */
      const includeMatch = docLine.match(this.INCLUDE_REGEX);

      if (includeMatch) {
        const subDocPath = path.join(path.dirname(docPath), includeMatch[3]);

        /* If there is an Error parsing the subdocument, throw an ReferenceError.
        If the error is already an ReferenceError pass the error by throwing it. */
        try {
          newContent = this.buildDocument(
            newContent,
            subDocPath,
            intendation.concat(
              includeMatch[1] ? this.getIndendation(docLine) : '',
            ),
            editorDocs,
            pathStack,
          );
        } catch (err) {
          this._includeErrors.push(
            new IncludeError(
              subDocPath,
              Range.create(
                Position.create(
                  index,
                  docLine.length - 1 - includeMatch[2].length,
                ),
                Position.create(index, docLine.length - 1),
              ),
              docPath,
              err.message ? 1 : 0,
            ),
          );
        }
      }
    }

    pathStack.pop();

    return newContent;
  }

  /**
   * Gets the indendation in front of `#` character and returns it.
   *
   * @param line - line contaiting `#include` comment with intendation.
   */
  private getIndendation(line: string): string {
    let result = '';
    let index = 0;

    while (line[index] !== '#') {
      result = result.concat(line[index]);
      index++;
    }

    return result;
  }

  /**
   * Checks whether `params` is instance of CompletionParams, since 'instanceOf'
   * cannot be used on interfaces.
   *
   * @param params - object which has to checked.
   */
  private instanceOfCompletionParams(
    params: TextDocumentPositionParams | CompletionParams,
  ): params is CompletionParams {
    return 'context' in params;
  }
}
