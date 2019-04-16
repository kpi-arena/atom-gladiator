import { DocumentSymbol } from 'vscode-languageserver-protocol';
import { Kind, load, YamlMap, YAMLNode, YAMLSequence } from 'yaml-ast-parser';
import { ILinesRelation } from './document-manager';

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
  private readonly _mainKeywordRegex = /tasks/i;

  constructor(
    private _content: string,
    private _relations: ILinesRelation[],
    private _uris: string[],
  ) {
    this._uris.forEach(uri => {
      this._outlines.set(uri, []);
    });

    const ast = load(this._content);
    console.log(ast);
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
      if (!this.isObject(item)) {
        return;
      }

      const testType = this.getStringValue(this.getNodeOfKey(item, 'type'));

      if (!testType) {
        return;
      }

      switch (testType) {
        case 'system':
      }

      const title = this.getStringValue(this.getNodeOfKey(item, 'title'));
      const score = this.getNumberValue(this.getNodeOfKey(item, 'score'));
      const replicas = this.getNumberValue(this.getNodeOfKey(item, 'replicas'));
    });

    return true;
  }

  private recursiveParse(node: YAMLNode, parent: DocumentSymbol) {
    if (!this.isObject(node)) {
      return;
    }

    const testType = this.getStringValue(this.getNodeOfKey(node, 'type'));

    if (!testType) {
      return;
    }

    switch (testType) {
      case 'system':
    }

    const title = this.getStringValue(this.getNodeOfKey(node, 'title'));
    const score = this.getNumberValue(this.getNodeOfKey(node, 'score'));
    const replicas = this.getNumberValue(this.getNodeOfKey(node, 'replicas'));
  }

  private parseGenericTestType(
    node: YAMLNode,
    parent: DocumentSymbol,
    type: TestType,
  ) {
    const title = this.getStringValue(this.getNodeOfKey(node, 'title'));
    const score = this.getNumberValue(this.getNodeOfKey(node, 'score'));
    const replicas = this.getNumberValue(this.getNodeOfKey(node, 'replicas'));

    let scoreNumber = 0;

    if (typeof score === 'number' && typeof replicas === 'number') {
      scoreNumber = score * replicas;
    } else if (typeof score === 'number') {
      scoreNumber = score;
    }
  }

  /* Getters based on types, keys, etc.: */
  private getNodeOfKey(object: YAMLNode, key: string): YAMLNode | null {
    if (!this.isObject(object)) {
      return null;
    }

    let result: YAMLNode | null = null;

    (object as YamlMap).mappings.some(mapping => {
      if (mapping.key.value !== key) {
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
