import { DocumentSymbol } from 'vscode-languageserver-protocol';
import {
  Position,
  Range,
  SymbolKind,
  TextDocument,
} from 'vscode-languageserver-types';
import { Kind, load, YamlMap, YAMLNode, YAMLSequence } from 'yaml-ast-parser';
import { ILinesRelation, SuperDocument } from './document-manager';

/**
 * 0 - suite
 * 1 - system
 * 2 - test:exec
 * 3 - test:ws
 */
declare type TestType = 0 | 1 | 2 | 3;

export class ScoreOutline {
  /* Key: uri, value: outline. */
  private _outlines: Map<string, DocumentSymbol[]> = new Map();
  private readonly _symbol = [
    SymbolKind.Array,
    SymbolKind.Class,
    SymbolKind.Method,
    SymbolKind.String,
  ];
  private _doc: TextDocument;

  constructor(
    private _superDoc: SuperDocument,
    private _relations: ILinesRelation[],
    private _uris: string[],
  ) {
    this._doc = TextDocument.create(
      '',
      SuperDocument.LANGUAGE_ID,
      0,
      this._superDoc.content,
    );
    this._uris.forEach(uri => {
      this._outlines.set(uri, []);
    });

    const ast = load(this._superDoc.content);
    this.createOutlines(ast);
    console.log(this._outlines);
  }

  private createOutlines(node: YAMLNode): boolean {
    if (!this.isObject(node)) {
      return false;
    }

    const tasks = this.getArray(this.getNodeOfKey(node, 'tasks'));

    if (!tasks) {
      return false;
    }

    tasks.forEach(item => {
      const parent = this._outlines.get(this._superDoc.uri) as DocumentSymbol[];
      this.recursiveParse(item, parent, this._superDoc.uri);
    });

    return true;
  }

  private recursiveParse(
    node: YAMLNode,
    destination: DocumentSymbol[],
    parentUri: string,
  ): number {
    if (!this.isObject(node)) {
      return 0;
    }

    const testType = this.getStringValue(this.getNodeOfKey(node, 'type'));

    if (!testType) {
      return 0;
    }

    switch (testType) {
      case 'suite':
        return this.parseTest(node, destination, parentUri, 0);
      case 'system':
        return this.parseTest(node, destination, parentUri, 1);
      case 'test:exec':
        return this.parseTest(node, destination, parentUri, 2);
      case 'test:ws':
        return this.parseTest(node, destination, parentUri, 3);
      default:
        return 0;
    }
  }

  private parseTest(
    node: YAMLNode,
    destination: DocumentSymbol[],
    parentUri: string,
    type: TestType,
  ): number {
    const title = this.getStringValue(this.getNodeOfKey(node, 'title'));
    const score = this.getNumberValue(this.getNodeOfKey(node, 'score'));
    const replicas = this.getNumberValue(this.getNodeOfKey(node, 'replicas'));

    let scoreNumber = 0;
    let titleValue = '';

    if (score !== null && replicas !== null) {
      scoreNumber = score * replicas;
    } else if (score !== null) {
      scoreNumber = score;
    }

    if (title !== null) {
      titleValue = title;
    }

    const range = Range.create(
      this._doc.positionAt(node.startPosition),
      this._doc.positionAt(node.endPosition),
    );

    const result = DocumentSymbol.create(
      `${titleValue}(${scoreNumber})`,
      undefined,
      this._symbol[type],
      range,
      range,
      undefined,
    );

    if (parentUri !== this._relations[range.start.line].originUri) {
      (this._outlines.get(
        this._relations[range.start.line].originUri,
      ) as DocumentSymbol[]).push(result);

      destination.push(
        DocumentSymbol.create(
          `#include (${score})`,
          undefined,
          SymbolKind.Event,
          Range.create(Position.create(0, 0), Position.create(0, 0)),
          Range.create(Position.create(0, 0), Position.create(0, 0)),
          undefined,
        ),
      );
    } else {
      destination.push(result);
    }

    if (type === 0) {
      const tasks = this.getNodeOfKey(node, 'tasks');

      destination[destination.length - 1].children = [];

      if (tasks !== null && this.isArray(tasks.value)) {
        (tasks.value as YAMLSequence).items.forEach(item => {
          scoreNumber += this.recursiveParse(
            item,
            destination[destination.length - 1].children as DocumentSymbol[],
            this._relations[range.start.line].originUri,
          );
        });
      }
    }

    return scoreNumber;
  }

  /* Getters based on types, keys, etc.: */
  private getNodeOfKey(object: YAMLNode, key: string): YAMLNode | null {
    if (!this.isObject(object)) {
      return null;
    }

    let result: YAMLNode | null = null;

    (object as YamlMap).mappings.some(mapping => {
      if (mapping.key.value === key) {
        result = mapping.value;
        return true;
      }

      return false;
    });

    return result;
  }

  private getArray(node: YAMLNode | null): YAMLNode[] | null {
    if (!node || !this.isArray(node)) {
      return null;
    }

    return (node as YAMLSequence).items;
  }

  private getStringValue(node: YAMLNode | null): string | null {
    if (!node) {
      return null;
    }

    if (this.isPrimitive(node) && this.isString(node)) {
      return node.value;
    }

    return null;
  }

  private getNumberValue(node: YAMLNode | null): number | null {
    if (!node) {
      return null;
    }

    if (this.isPrimitive(node) && this.isNumber(node)) {
      return node.valueObject;
    }

    return null;
  }

  /* Type checks: */
  private isObject(node: YAMLNode): boolean {
    return node.kind === Kind.MAP;
  }

  private isArray(node: YAMLNode): boolean {
    return node.kind === Kind.SEQ;
  }

  private isPrimitive(node: YAMLNode): boolean {
    return node.kind === Kind.SCALAR;
  }

  private isNull(node: YAMLNode): boolean {
    return !node.value || (node.valueObject && node.valueObject === null);
  }

  private isNumber(node: YAMLNode): boolean {
    return (
      node.valueObject &&
      typeof node.valueObject === 'number' &&
      !this.isNull(node)
    );
  }

  private isBoolean(node: YAMLNode): boolean {
    return typeof node.valueObject === 'boolean' && !this.isNumber(node);
  }

  private isString(node: YAMLNode): boolean {
    return !this.isBoolean(node);
  }
}
