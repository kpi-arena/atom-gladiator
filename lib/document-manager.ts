import { Convert } from 'atom-languageclient';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import {
  CompletionParams,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeTextDocumentParams,
  DidOpenTextDocumentParams,
  DidSaveTextDocumentParams,
  PublishDiagnosticsParams,
  TextDocument,
  TextDocumentPositionParams,
  TextEdit,
  WillSaveTextDocumentParams,
} from 'vscode-languageserver-protocol';
import { Position, Range } from 'vscode-languageserver-types';

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

  /* Global length of indendation of the original document, not just related
  to it's parent documents. */
  intendationLength: number;
}

/**
 * 0 - Missing `root` comment,
 * 1 - Missing `include` comment,
 * 2 - Root file couldn't be loaded,
 * 3 - Include file couldn't be loaded.
 */
declare type refErrType = 0 | 1 | 2 | 3 | 4;

/** Used when the file specified by `include` or `root` comment canoot be found. */
class ReferenceError extends Error {
  /* Item at index + 1 is an error message to 'refErrType'. */
  private static readonly _errorMessages: Array<
    [string, DiagnosticSeverity]
  > = [
    ['Missing root comment.', 3],
    ['Missing include comment.', 3],
    ['File not found:', 1],
    ['File not found:', 1],
    ['Reference causes infinite loop', 1],
  ];

  /**
   * @param _filePath - path to the file in the reference comment,
   * @param _range - range of the error,
   * @param _uri - URI of the document in which the error has to be shown.
   * @param _errType - type of reference error.
   */
  constructor(
    private _filePath: string,
    private _range: Range,
    private _uri: string,
    private _errType: refErrType,
  ) {
    super();
  }

  /** URI of the file in which the error is located. */
  public get uri(): string {
    return this._uri;
  }

  /** Returns a Diagnostic pointing to the invalid reference. */
  public get diagnostic(): Diagnostic {
    return {
      severity: ReferenceError._errorMessages[this._errType][1],
      message:
        this._errType > 2
          ? ReferenceError._errorMessages[this._errType][0]
          : `${ReferenceError._errorMessages[this._errType][0]} ${
              this._filePath
            }`,
      range: this._range,
    };
  }
}

export class SuperDocument {
  public static getBasicTextDocument(
    docPath: string,
    editorDocs?: Map<string, TextDocument>,
  ): TextDocument | undefined {
    if (!editorDocs) {
      editorDocs = SuperDocument.getOpenYAMLDocuments();
    }

    let doc = SuperDocument.getOpenYAMLDocuments().get(docPath);

    /* Checking if the document is open in the editor. In case it's not, get
    the doc from the drive. */
    if (!doc) {
      doc = this.getDocumentFromDrive(docPath);
    }

    return doc;
  }

  private static getFileContent(
    filePath: string,
    editorDocs: Map<string, TextDocument>,
  ): string {
    let result: string;
    const doc = SuperDocument.getOpenYAMLDocuments().get(filePath);

    /* Checking if the document is open in the editor. In case it's not, get
    the doc from the drive. */
    if (!doc) {
      try {
        result = readFileSync(filePath).toString();
      } catch (err) {
        result = '';
      }
    } else {
      result = doc.getText();
    }

    return result;
  }

  /**
   * Creates a map from YAML documents in current workspace. Key value in the
   * map represents path to the document. The value is a TextDocument created
   * from document in buffer of the text editor. In case the document doesn't
   * have a path it's ignored, since for including documents in other documents
   * a path is required.
   */
  private static getOpenYAMLDocuments(): Map<string, TextDocument> {
    const result: Map<string, TextDocument> = new Map();

    atom.workspace.getTextEditors().forEach(editor => {
      const editorPath = editor.getBuffer().getPath();

      /* Skipping file if it's not a YAML file saved on drive. */
      if (!editorPath || !editorPath.match(/(\.yaml|\.yml)$/i)) {
        return;
      }

      /* Pushing a TextDocument created from open YAML docoment. */
      result.set(
        editorPath,
        TextDocument.create(
          editor.getBuffer().getUri(),
          SuperDocument.LANGUAGE_ID,
          0,
          editor.getBuffer().getText(),
        ),
      );
    });

    return result;
  }

  /**
   * Reads the file given by `docPath` and creates TextDocument from it's
   * content. Returns the created TextDocument or undefined, if the file
   * could not been read.
   * @param docPath - full path to the file containing YAML document.
   */
  private static getDocumentFromDrive(
    docPath: string,
  ): TextDocument | undefined {
    /* Creating a TextDocument from a YAML file located on the drive. If error
    occurs while reading file, the error is caught and undefined is returned. */
    try {
      return TextDocument.create(
        Convert.pathToUri(docPath),
        SuperDocument.LANGUAGE_ID,
        0,
        readFileSync(docPath).toString(),
      );
    } catch (err) {
      return undefined;
    }
  }

  public static readonly LANGUAGE_ID = 'yaml';
  private readonly ROOT_REGEX = /^(\cI|\t|\x20)*#root:((\.|\\|\/|\w|-)+(\.yaml|\.yml))(\cI|\t|\x20)*/;
  private readonly INCLUDE_REGEX = /^(\cI|\t|\x20)*(#include:((\.|\\|\/|\w|-)+(\.yaml|\.yml)))(\cI|\t|\x20)*/;
  private _content: string;
  private _relatadUris: string[] = [];
  private _originRelation: Map<number, ILinesRelation[]> = new Map();
  private _newRelation: ILinesRelation[] = [];
  private _referenceErrors: ReferenceError[] = [];
  private _uriStack: string[] = [];

  constructor(text: string, private _uri: string, private _version: number) {
    this._content = this.getContent(text, this._uri);
  }

  /**
   * Used when the document, or any of the subdocuments is opened. The params
   * are in context of the whole document, so diagnostics are returned for all
   * retlated files - use `filterDiagnostics` for filter them.
   */
  public get DidOpenTextDocumentParams(): DidOpenTextDocumentParams {
    return {
      textDocument: {
        languageId: SuperDocument.LANGUAGE_ID,
        text: this._content,
        uri: this._uri,
        version: this._version,
      },
    };
  }

  /** Used everytime the root document or any of it's subdocuments is changed. */
  public get DidChangeTextDocumentParams(): DidChangeTextDocumentParams {
    return {
      contentChanges: [{ text: this._content }],
      textDocument: {
        uri: this._uri,
        version: this._version,
      },
    };
  }

  /** Used before the document is actually saved. */
  public getwillSaveTextDocumentParams(
    params: WillSaveTextDocumentParams,
  ): WillSaveTextDocumentParams {
    return {
      textDocument: {
        uri: this._uri,
      },
      reason: params.reason,
    };
  }

  /** Used when the document is saved. */
  public getDidSaveTextDocumentParams(
    params: DidSaveTextDocumentParams,
  ): DidSaveTextDocumentParams {
    return {
      text: params.text,
      textDocument: {
        uri: this._uri,
        version: params.textDocument.version,
      },
    };
  }

  /** Returns array of URIs of the root document and all it's subdocuments. */
  public get relatedUris(): string[] {
    return this._relatadUris;
  }

  /** Returns URI of the root document. */
  public get uri(): string {
    return this._uri;
  }

  public get content(): string {
    return this._content;
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
    this._relatadUris.forEach(relatedUri => {
      result.set(relatedUri, {
        uri: relatedUri,
        version: params.version,
        diagnostics: [],
      });
    });

    params.diagnostics.forEach(diagnose => {
      const startRelation = this._newRelation[diagnose.range.start.line];

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
    this._referenceErrors.forEach(err => {
      const correspondingDiagnostics = result.get(err.uri);

      if (correspondingDiagnostics) {
        correspondingDiagnostics.diagnostics.push(err.diagnostic);
      }
    });

    return result;
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

    /* If 'params' are instance of CompletionParams add 'context' to he result. */
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
    const lineRelation = this._originRelation.get(params.position.line);

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

          params.textDocument.uri = this._uri;

          return params;
        }
      }
    }

    return params;
  }

  /**
   * Transforms `superRange` from the super document to range in the one of
   * it's subdocuments. If the range ends outside of the subdocument, it's end
   * is set to the end of the subdocument. Transform also the intendation.
   *
   * @param superRange - range in the super document.
   */
  public transformRange(superRange: Range): Range {
    const startRelation = this._newRelation[superRange.start.line];

    let endRelation = this._newRelation[superRange.start.line];

    /* Going through '_newRelation' until the end of the super document is
    reacher, or the next line is not from the subdocument or the end line is
    found. */
    while (
      endRelation.newLine + 1 < this._newRelation.length &&
      this._newRelation[endRelation.newLine + 1].originUri ===
        startRelation.originUri &&
      superRange.end.line !== endRelation.newLine
    ) {
      endRelation = this._newRelation[endRelation.newLine + 1];
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

  private getContent(text: string, uri: string): string {
    this._relatadUris = [];
    this._newRelation = [];
    this._uriStack = [];
    const editorDocs = SuperDocument.getOpenYAMLDocuments();

    const rootPath = this.getRootPath(text, uri);

    /* If file path and rootpath aren't equal, check if their references are correct. */
    if (rootPath !== Convert.uriToPath(uri)) {
      try {
        existsSync(rootPath);
      } catch (e) {
        /* Root file in root comment doesn't exist. */
        this._referenceErrors.push(
          new ReferenceError(
            rootPath,
            Range.create(Position.create(0, 0), Position.create(0, 5)),
            uri,
            2,
          ),
        );
      }

      const rootContent = SuperDocument.getFileContent(rootPath, editorDocs);

      /* Root doesn't have include comment. */
      if (!new RegExp(this.INCLUDE_REGEX, 'm').test(rootContent)) {
        this._referenceErrors.push(
          new ReferenceError(
            Convert.uriToPath(uri),
            Range.create(Position.create(0, 0), Position.create(0, 1)),
            Convert.pathToUri(rootPath),
            1,
          ),
        );
      }
    }

    this._uri = Convert.pathToUri(rootPath);

    return this.buildDoc('', rootPath, '', editorDocs);
  }

  /**
   * Revursively inserts TextDocuments given by `#include` comment in the docu-
   * ment given by docPath. Return a `string`, which contains `newContent` con-
   * cated with it's subdocuments.
   *
   * @param newContent - string to which the document, given by `docPath` is
   * appended,
   * @param docPath - path of the document to be parsed and appended,
   * @param intendation - intedantion of the document that is appended to each
   * inserted line,
   * @param editorDocs - map of the documents open in the editor, where the key
   * represents the path and value is a TextDocument created from the document.
   */
  private buildDoc(
    newContent: string,
    docPath: string,
    intendation: string,
    editorDocs: Map<string, TextDocument>,
  ): string {
    const doc = SuperDocument.getBasicTextDocument(docPath, editorDocs);

    /* If the document could not be read, throw an error. */
    if (!doc) {
      throw new Error();
    }
    const docUri = Convert.pathToUri(docPath);

    /* Checking if the file is already in stack, in case it is throw an error. */
    if (this._uriStack.indexOf(docUri) > -1) {
      throw new Error('i');
    }

    this._uriStack.push(docUri);

    this._relatadUris.push(docUri);

    const docintendationLength = intendation.length;

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

        /* Checking if first line has root reference, if not, add an error. If
        the line is the first line of the root document, ignore it. */
        if (
          index === 0 &&
          this._uriStack.length > 1 &&
          !docLine.match(this.ROOT_REGEX)
        ) {
          this._referenceErrors.push(
            new ReferenceError(
              Convert.uriToPath(this._uri),
              Range.create(doc.positionAt(index), doc.positionAt(index + 1)),
              docUri,
              0,
            ),
          );
        }
      }

      /* Appening the intendation of the document and the line from the docu-
      ment to the newContent. */
      newContent = newContent.concat(intendation, docLine);

      /* Setting line relation variables to appropriate values. */
      const newLineRelation = {
        newLine: this._newRelation.length,
        originLine: index,
        originUri: docUri,
        intendationLength: docintendationLength,
      };

      if (this._originRelation.has(index)) {
        (this._originRelation.get(index) as ILinesRelation[]).push(
          newLineRelation,
        );
      } else {
        this._originRelation.set(index, [newLineRelation]);
      }

      this._newRelation.push(newLineRelation);

      /* Checking if the line contains #include statement, in case it does
      recursively call buildDoc(). */
      const includeMatch = docLine.match(this.INCLUDE_REGEX);

      if (includeMatch) {
        const subDocPath = path.join(path.dirname(docPath), includeMatch[3]);

        /* If there is an Error parsing the subdocument, throw an ReferenceError.
        If the error is already an ReferenceError pass the error by throwing it. */
        try {
          newContent = this.buildDoc(
            newContent,
            subDocPath,
            intendation.concat(
              includeMatch[1] ? this.getIndendation(docLine) : '',
            ),
            editorDocs,
          );
        } catch (err) {
          this._referenceErrors.push(
            new ReferenceError(
              subDocPath,
              Range.create(
                Position.create(
                  index,
                  docLine.length - 1 - includeMatch[2].length,
                ),
                Position.create(index, docLine.length - 1),
              ),
              docUri,
              err.message ? 4 : 3,
            ),
          );
        }
      }
    }

    this._uriStack.pop();

    return newContent;
  }

  /**
   * Checks if the `text` contains `#root` reference and returns the full path
   * to the root document. In case it doesn't contain the reference, full path
   * of the file given by uri is returned.
   *
   * @param text - content of a document,
   * @param uri - uri of a document.
   */
  private getRootPath(text: string, uri: string): string {
    const matchedComment = text.match(this.ROOT_REGEX);

    /* Check if the first line contains '#root' comment. In case it doesn't
    return path of this document. In case it does, return the path to the root. */
    if (!matchedComment || !matchedComment[2]) {
      return Convert.uriToPath(uri);
    }

    return path.join(path.dirname(Convert.uriToPath(uri)), matchedComment[2]);
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
