import { Convert } from 'atom-languageclient';
import { readFileSync } from 'fs';
import * as path from 'path';
import {
  DidOpenTextDocumentParams,
  PublishDiagnosticsParams,
  TextDocument,
} from 'vscode-languageserver-protocol';

interface ILinesRelation {
  originLine: number;
  originUri: string;
  intendationLength: number;
}

export class SuperDocument {
  private readonly ROOT_REGEX = /^(\cI|\t|\x20)*#root:((\.|\\|\/|\w|-)+(\.yaml|\.yml))(\cI|\t|\x20)*/;
  private readonly INCLUDE_REGEX = /^(\cI|\t|\x20)*#include:((\.|\\|\/|\w|-)+(\.yaml|\.yml))(\cI|\t|\x20)*/;
  private readonly LANGUAGE_ID = 'yaml';

  private _linesRelation: ILinesRelation[] = [];
  private _content: string;
  private _uri: string;
  private _version: number;
  private _relatadUris: string[] = [];

  constructor(request: DidOpenTextDocumentParams) {
    this._uri = request.textDocument.uri;
    this._version = request.textDocument.version;
    this._content = this.getContent(request.textDocument.text);
  }

  public test() {
    const doc = TextDocument.create(
      this._uri,
      this.LANGUAGE_ID,
      this._version,
      this._content,
    );

    // @ts-ignore
    const lineOffsets: number[] = doc.getLineOffsets();

    for (let index = 0; index < lineOffsets.length - 1; index++) {
      console.log(
        `${index}: ${lineOffsets[index]} - ${
          this._linesRelation[index].originLine
        }|${this._linesRelation[index].originUri}`,
      );
    }

    console.log(Convert.pathToUri(this._linesRelation[8].originUri));
    console.log(this._uri);
  }

  public get DidOpenTextDocumentParams(): DidOpenTextDocumentParams {
    return {
      textDocument: {
        languageId: this.LANGUAGE_ID,
        text: this._content,
        uri: this._uri,
        version: this._version,
      },
    };
  }

  public get relatedUris(): string[] {
    return this._relatadUris;
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

    params.diagnostics.forEach(diagnose => {
      const startRelation = this._linesRelation[diagnose.range.start.line];

      /* If the URI is not present in the result Map, PublishDiagnosticsParams
      with empty diagnostics. */
      if (!result.has(startRelation.originUri)) {
        result.set(startRelation.originUri, {
          uri: startRelation.originUri,
          version: params.version,
          diagnostics: [],
        });
      }

      /* Push diagnostic of a document to diagnostics[] of the corresponding
      document, which is determined by URI. Also the range of the diagnostic
      translated to correspond with the original document's positions. */
      (result.get(
        startRelation.originUri,
      ) as PublishDiagnosticsParams).diagnostics.push({
        code: diagnose.code,
        message: diagnose.message,
        range: {
          start: {
            line: startRelation.originLine,
            character: diagnose.range.start.character,
          },
          end: {
            line: this._linesRelation[diagnose.range.end.line].originLine,
            character: diagnose.range.end.character,
          },
        },
        relatedInformation: diagnose.relatedInformation,
        severity: diagnose.severity,
        source: diagnose.source,
      });
    });

    return result;
  }

  private getContent(text: string): string {
    this._relatadUris = [];

    this._linesRelation = [];

    const editorDocs = this.getOpenYAMLDocuments();

    const rootPath = this.getRootPath(text, this._uri);

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
    this._relatadUris.push(Convert.pathToUri(docPath));

    const docintendationLength = intendation.length;
    let doc = editorDocs.get(docPath);

    /* Checking if the document is open in the editor. In case it's not, get
    the doc from the drive. */
    if (!doc) {
      doc = this.getDocumentFromDrive(docPath);

      /* If the document could not be read, throw an error. */
      if (!doc) {
        throw new Error();
      }
    }

    /* Using @ts-ignore to ignore the error, caused by accessing private method
    to obtain line offsets od the document. */
    // @ts-ignore
    const docOffsets: number[] = doc.getLineOffsets();

    for (let index = 0; index < docOffsets.length - 1; index++) {
      const docLine = doc.getText({
        start: doc.positionAt(docOffsets[index]),
        end: doc.positionAt(docOffsets[index + 1]),
      });

      /* Appening the intendation of the document and the line from the docu-
      ment to the newContent. */
      newContent = newContent.concat(intendation, docLine);

      this._linesRelation.push({
        originLine: index,
        originUri: Convert.pathToUri(docPath),
        intendationLength: docintendationLength,
      });

      const includeMatch = docLine.match(this.INCLUDE_REGEX);

      /* Checking, if the line contains #include statement recursively call
      buildDoc(). */
      if (includeMatch) {
        const subDocPath = path.join(path.dirname(docPath), includeMatch[2]);

        newContent = this.buildDoc(
          newContent,
          subDocPath,
          intendation.concat(
            includeMatch[1] ? this.getIndendation(docLine) : '',
          ),
          editorDocs,
        );
      }
    }

    return newContent;
  }

  /**
   * Creates a map from YAML documents in current workspace. Key value in the
   * map represents path to the document. The value is a TextDocument created
   * from document in buffer of the text editor. In case the document doesn't
   * have a path it's ignored, since for including documents in other documents
   * a path is required.
   */
  private getOpenYAMLDocuments(): Map<string, TextDocument> {
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
          this.LANGUAGE_ID,
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
  private getDocumentFromDrive(docPath: string): TextDocument | undefined {
    /* Creating a TextDocument from a YAML file located on the drive. If error
    occurs while reading file, the error is caught and undefined is returned. */
    try {
      return TextDocument.create(
        Convert.pathToUri(docPath),
        this.LANGUAGE_ID,
        0,
        readFileSync(docPath).toString(),
      );
    } catch (err) {
      return undefined;
    }
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
}
