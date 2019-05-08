import * as path from 'path';
import { Position, Range, TextDocument } from 'vscode-languageserver-protocol';
import { IncludeError } from './include-error';
import { getBasicTextDocument, getOpenYAMLDocuments } from './util';

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

export class SpecialDocument {
  private readonly INCLUDE_REGEX = /^(\cI|\t|\x20)*(#include ((\.|\\|\/|\w|-)+(\.yaml|\.yml)))(\cI|\t|\x20)*/;

  private _relatedPaths: string[] = [];
  private _newToOld: ILinesRelation[] = [];
  private _oldToNew: Map<number, ILinesRelation[]> = new Map();
  private _includeErrors: IncludeError[] = [];

  constructor(private _rootPath: string) {
    const editorDocs = getOpenYAMLDocuments();
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
    this._relatedPaths.push(docPath);

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
        originUri: docPath,
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
}
