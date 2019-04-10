import { Convert } from 'atom-languageclient';
import fs, { readFileSync } from 'fs';
import * as path from 'path';
import {
  DidOpenTextDocumentParams,
  PublishDiagnosticsParams,
  TextDocument,
} from 'vscode-languageserver-protocol';

export class SuperDocument {
  private readonly ROOT_REGEX = /^(\cI|\t|\x20)*#root:((\.|\\|\/|\w|-)+(\.yaml|\.yml))(\cI|\t|\x20)*/;
  private readonly _languageID = 'yaml';
  private readonly INCLUDE_REGEX = /^(\cI|\t|\x20)*#include:((\.|\\|\/|\w|-)+(\.yaml|\.yml))(\cI|\t|\x20)*/;
  private _newText: string = '';
  private _docs: Map<string, TextDocument> = new Map();
  private _linesRelation: ILinesRelation[] = [];
  private _rootDirectory: string = '';
  // private _request: DidOpenTextDocumentParams;

  constructor(request: DidOpenTextDocumentParams) {
    // this._request = this.createRequest(request);
  }

  public buildRequest(request: DidOpenTextDocumentParams) {
    const editorDocs = this.getOpenYAMLDocuments();

    const rootPath = this.getRootPath(
      request.textDocument.text,
      request.textDocument.uri,
    );

    console.log(rootPath);

    const content = this.buildDoc('', rootPath, '', editorDocs);

    const doc = TextDocument.create('', this._languageID, 0, content);
    // @ts-ignore
    const docOffsets: number[] = doc.getLineOffsets();

    for (let index = 0; index < docOffsets.length; index++) {
      const originalLine = doc.getText({
        start: doc.positionAt(docOffsets[index]),
        end: doc.positionAt(docOffsets[index + 1]),
      });
      console.log(`${docOffsets[index]}  - ${index} - ${originalLine}`);
    }
  }

  // public get request(): DidOpenTextDocumentParams {
  //   return this._request;
  // }

  public filterAnswer(
    params: PublishDiagnosticsParams,
  ): PublishDiagnosticsParams {
    const doc = this._docs.get(Convert.uriToPath(params.uri));

    if (!doc) {
      return params;
    }

    const newParams: PublishDiagnosticsParams = {
      uri: params.uri,
      version: params.version,
      diagnostics: [],
    };

    params.diagnostics.forEach(value => {
      if (
        this._linesRelation[value.range.start.line].originPath ===
        Convert.uriToPath(doc.uri)
      ) {
        const newValue = value;

        newValue.range.start.line = this._linesRelation[
          value.range.start.line
        ].originLine;

        newValue.range.end.line = this._linesRelation[
          value.range.end.line
        ].originLine;

        newParams.diagnostics.push(newValue);
      }
    });

    return newParams;
  }

  private createRequest(
    request: DidOpenTextDocumentParams,
  ): DidOpenTextDocumentParams {
    this._docs = this.getDocuments(request);

    const rootPath = this.getRootPath(
      request.textDocument.text,
      request.textDocument.uri,
    );

    const rootDoc = this._docs.get(rootPath);

    if (!rootDoc) {
      return request;
    }

    this._rootDirectory = path.dirname(rootPath);

    this.recursiveTextInsert(
      rootDoc,
      this.getRootPath(request.textDocument.text, request.textDocument.uri),
    );

    console.log(this._newText);

    return {
      textDocument: {
        languageId: 'yaml',
        version: rootDoc.version,
        text: this._newText,
        uri: request.textDocument.uri,
      },
    };
  }

  private recursiveTextInsert(doc: TextDocument, docPath: string) {
    // @ts-ignore
    const docOffsets: number[] = doc.getLineOffsets();

    for (let index = 0; index < docOffsets.length - 1; index++) {
      const originalLine = doc.getText({
        start: doc.positionAt(docOffsets[index]),
        end: doc.positionAt(docOffsets[index + 1]),
      });

      if (originalLine.match(/#root:\s*([^\n\r\s]*(\.yaml|\.yml))/i)) {
        continue;
      }

      const lineMatch = originalLine.match(
        /^(\t|\cI|\x20)*#include:(\t|\cI|\x20)*([^\n\r\t\cI\x20]*(\.yaml|\.yml))(\t|\cI|\x20)*$/im,
      );

      if (lineMatch) {
        const subDoc = this._docs.get(
          path.join(this._rootDirectory, lineMatch[3]),
        );

        if (subDoc) {
          this.recursiveTextInsert(subDoc, lineMatch[3]);
        }
      } else {
        this._newText = this._newText.concat(originalLine);
        this._linesRelation.push({
          originLine: docOffsets[index],
          originPath: path.join(this._rootDirectory, docPath),
          intendationLength: 0,
        });
      }
    }
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
        originPath: docPath,
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
          intendation.concat(includeMatch[1] ? includeMatch[1] : ''),
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
          this._languageID,
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
        this._languageID,
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

  private getDocuments(
    request: DidOpenTextDocumentParams,
  ): Map<string, TextDocument> {
    const rootPath = this.getRootPath(
      request.textDocument.text,
      request.textDocument.uri,
    );

    let rootDocument: TextDocument | null = null;

    /* In case rootDocument is equal to the document from request. */
    if (rootPath === Convert.uriToPath(request.textDocument.uri)) {
      rootDocument = TextDocument.create(
        request.textDocument.uri,
        request.textDocument.languageId,
        request.textDocument.version,
        request.textDocument.text,
      );
    } else {
      /* Getting root document from editor. */
      atom.workspace.getTextEditors().forEach(editor => {
        if (editor.getBuffer().getPath() === rootPath) {
          rootDocument = TextDocument.create(
            editor.getBuffer().getUri(),
            'yaml',
            0,
            editor.getBuffer().getText(),
          );
        }
      });
    }

    /* Reading file from drive in case it was not assigned yet. */
    if (!rootDocument) {
      rootDocument = TextDocument.create(
        Convert.pathToUri(rootPath),
        'yaml',
        0,
        readFileSync(rootPath, { encoding: 'utf8' }),
      );
    }

    const includesMatch = rootDocument
      .getText()
      .match(
        /^(\t|\cI|\x20)*#include:([^\n\r]*(\.yaml|\.yml))(\t|\cI|\x20)*$/gim,
      );

    const subDocumentPaths: Map<string, boolean> = new Map();
    const documents: Map<string, TextDocument> = new Map();

    documents.set(rootPath, rootDocument);

    if (!includesMatch) {
      // TODO handle exception
      return documents;
    }

    includesMatch.forEach(match => {
      const subPath = match.match(
        /^(\t|\cI|\x20)*#include:(\t|\cI|\x20)*([^\n\r\t\cI\x20]*(\.yaml|\.yml))(\t|\cI|\x20)*$/im,
      );

      if (!subPath) {
        return;
      }

      subDocumentPaths.set(
        path.join(path.dirname(rootPath), subPath[3]),
        false,
      );
    });

    /* Adding files from editor. */
    atom.workspace.getTextEditors().forEach(editor => {
      const editorPath = editor.getBuffer().getPath();

      /* Skipping file if it's not a YAML file saved on drive. */
      if (
        !editorPath ||
        !editorPath.match(/(\.yaml|\.yml)$/i) ||
        !subDocumentPaths.get(editorPath)
      ) {
        return;
      }

      documents.set(
        editorPath,
        TextDocument.create(
          editor.getBuffer().getUri(),
          'yaml',
          0,
          editor.getBuffer().getText(),
        ),
      );

      const pathEntry = subDocumentPaths.get(editorPath);

      if (pathEntry !== undefined) {
        subDocumentPaths.set(editorPath, true);
      }
    });

    /* Adding files from drive. */
    subDocumentPaths.forEach((isSet: boolean, subPath: string) => {
      if (isSet) {
        return;
      }

      documents.set(
        subPath,
        TextDocument.create(
          Convert.pathToUri(subPath),
          'yaml',
          0,
          readFileSync(subPath, { encoding: 'utf8' }),
        ),
      );
    });

    return documents;
  }
}

interface ILinesRelation {
  originLine: number;
  originPath: string;
  intendationLength: number;
}
