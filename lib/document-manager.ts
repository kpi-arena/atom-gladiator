import { Convert } from 'atom-languageclient';
import fs, { readFileSync } from 'fs';
import * as path from 'path';
import {
  DidOpenTextDocumentParams,
  TextDocument,
} from 'vscode-languageserver-protocol';

export class SuperDocument {
  // private _roots: Map<string, ConfDocument> = new Map();

  public getSuperDoc(
    request: DidOpenTextDocumentParams,
  ): DidOpenTextDocumentParams {
    const docs = this.getDocuments(request);

    const rootDoc = docs.get(
      this.getRootPath(request.textDocument.text, request.textDocument.uri),
    );

    if (!rootDoc) {
      return request;
    }

    // @ts-ignore
    const rootLineOffsets: number[] = rootDoc.getLineOffsets();

    const linesRelation: ILinesRelation[] = [];

    let newText: string = '';

    // TODO: add exception for rootLineOffsets of length 1
    for (let index = 0; index < rootLineOffsets.length - 1; index++) {
      const originalLine = rootDoc.getText({
        start: rootDoc.positionAt(rootLineOffsets[index]),
        end: rootDoc.positionAt(rootLineOffsets[index + 1]),
      });

      // if (originalLine)
    }

    console.log({ lol: newText });

    return request;
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

  private getRootPath(text: string, uri: string): string {
    const matchedComment = text.match(/#root:\s*([^\n\r\s]*(\.yaml|\.yml))/i);

    if (!matchedComment || !matchedComment[1]) {
      return Convert.uriToPath(uri);
    }

    return path.join(path.dirname(Convert.uriToPath(uri)), matchedComment[1]);
  }
}

interface ILinesRelation {
  originLine: number;
  originPath: string;
  newDocLine: number;
}
// #root:\s*([^\n\r\s]*(\.yaml|\.yml))
// interface TextDocumentItem {
// 	/**
// 	 * The text document's URI.
// 	 */
// 	uri: DocumentUri;

// 	/**
// 	 * The text document's language identifier.
// 	 */
// 	languageId: string;

// 	/**
// 	 * The version number of this document (it will increase after each
// 	 * change, including undo/redo).
// 	 */
// 	version: number;

// 	/**
// 	 * The content of the opened text document.
// 	 */
// 	text: string;
// }
