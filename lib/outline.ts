import {
  DocumentSymbol,
  Position,
  Range,
  SymbolKind,
  TextDocument,
} from 'vscode-languageserver-protocol';
import {
  Kind,
  load,
  YAMLAnchorReference,
  YamlMap,
  YAMLMapping,
  YAMLNode,
  YAMLScalar,
  YAMLSequence,
} from 'yaml-ast-parser';
import { SpecialDocument } from './special-document';

export class SingleFileOutline {
  constructor(private _doc: TextDocument) {}

  public getOutline(): DocumentSymbol[] {
    return this.parseYamlNode(load(this._doc.getText()));
  }

  public test(): DocumentSymbol[] {
    const result: DocumentSymbol[] = [];

    const r = Range.create(Position.create(0, 0), Position.create(0, 0));

    result.push(
      DocumentSymbol.create('Array', undefined, SymbolKind.Array, r, r),
    );
    result.push(
      DocumentSymbol.create('Boolean', undefined, SymbolKind.Boolean, r, r),
    );
    result.push(
      DocumentSymbol.create('Class', undefined, SymbolKind.Class, r, r),
    );
    result.push(
      DocumentSymbol.create('Constant', undefined, SymbolKind.Constant, r, r),
    );
    result.push(
      DocumentSymbol.create(
        'Constructor',
        undefined,
        SymbolKind.Constructor,
        r,
        r,
      ),
    );
    result.push(
      DocumentSymbol.create('Enum', undefined, SymbolKind.Enum, r, r),
    );
    result.push(
      DocumentSymbol.create(
        'EnumMember',
        undefined,
        SymbolKind.EnumMember,
        r,
        r,
      ),
    );
    result.push(
      DocumentSymbol.create('Event', undefined, SymbolKind.Event, r, r),
    );
    result.push(
      DocumentSymbol.create('Field', undefined, SymbolKind.Field, r, r),
    );
    result.push(
      DocumentSymbol.create('File', undefined, SymbolKind.File, r, r),
    );
    result.push(
      DocumentSymbol.create('Function', undefined, SymbolKind.Function, r, r),
    );
    result.push(
      DocumentSymbol.create('Interface', undefined, SymbolKind.Interface, r, r),
    );
    result.push(DocumentSymbol.create('Key', undefined, SymbolKind.Key, r, r));
    result.push(
      DocumentSymbol.create('Method', undefined, SymbolKind.Method, r, r),
    );
    result.push(
      DocumentSymbol.create('Module', undefined, SymbolKind.Module, r, r),
    );
    result.push(
      DocumentSymbol.create('Namespace', undefined, SymbolKind.Namespace, r, r),
    );
    result.push(
      DocumentSymbol.create('Null', undefined, SymbolKind.Null, r, r),
    );
    result.push(
      DocumentSymbol.create('Number', undefined, SymbolKind.Number, r, r),
    );
    result.push(
      DocumentSymbol.create('Object', undefined, SymbolKind.Object, r, r),
    );
    result.push(
      DocumentSymbol.create('Operator', undefined, SymbolKind.Operator, r, r),
    );
    result.push(
      DocumentSymbol.create('Package', undefined, SymbolKind.Package, r, r),
    );
    result.push(
      DocumentSymbol.create('Property', undefined, SymbolKind.Property, r, r),
    );
    result.push(
      DocumentSymbol.create('String', undefined, SymbolKind.String, r, r),
    );
    result.push(
      DocumentSymbol.create('Struct', undefined, SymbolKind.Struct, r, r),
    );
    result.push(
      DocumentSymbol.create(
        'TypeParameter',
        undefined,
        SymbolKind.TypeParameter,
        r,
        r,
      ),
    );
    result.push(
      DocumentSymbol.create('Variable', undefined, SymbolKind.Variable, r, r),
    );

    return result;
  }

  private parseYamlNode(node: YAMLNode): DocumentSymbol[] {
    if (!node) {
      return [];
    }

    switch (node.kind) {
      case Kind.ANCHOR_REF:
        return this.parseYamlAnchorReference(node as YAMLAnchorReference);
      case Kind.MAP:
        return this.parseYamlMap(node as YamlMap);
      case Kind.MAPPING:
        return this.parseYamlMapping(node as YAMLMapping);
      case Kind.SCALAR:
        return this.parseYamlScalar(node as YAMLScalar);
      case Kind.SEQ:
        return this.parseYamlSequence(node as YAMLSequence);
      default:
        return [];
    }
  }

  private parseYamlAnchorReference(
    node: YAMLAnchorReference,
  ): DocumentSymbol[] {
    return this.parseYamlNode(node.value);
  }

  private parseYamlMap(map: YamlMap): DocumentSymbol[] {
    let children: DocumentSymbol[] = [];

    map.mappings.forEach(mapping => {
      const parsedMapping = this.parseYamlMapping(mapping);

      children = children.concat(parsedMapping);
    });

    if (!map.key) {
      return children;
    }

    return [
      DocumentSymbol.create(
        this.getKeyName(map),
        undefined,
        SymbolKind.Object,
        this.getRange(map),
        this.getRange(map),
        children,
      ),
    ];
  }

  private parseYamlMapping(mapping: YAMLMapping): DocumentSymbol[] {
    return [
      DocumentSymbol.create(
        this.getKeyName(mapping),
        undefined,
        this.getSymbolKind(mapping.value),
        this.getRange(mapping),
        this.getRange(mapping),
        this.parseYamlNode(mapping.value),
      ),
    ];
  }

  private parseYamlScalar(scalar: YAMLScalar): DocumentSymbol[] {
    return [];
  }

  private parseYamlSequence(sequence: YAMLSequence): DocumentSymbol[] {
    const children: DocumentSymbol[] = [];

    sequence.items.forEach((item, index) => {
      children.push(
        DocumentSymbol.create(
          `(${index})`,
          undefined,
          SymbolKind.Module,
          this.getRange(item),
          this.getRange(item),
          this.parseYamlNode(item),
        ),
      );
      // children = children.concat(this.parseYamlNode(item));
    });

    if (!sequence.key) {
      return children;
    }

    return [
      DocumentSymbol.create(
        this.getKeyName(sequence),
        undefined,
        this.getSymbolKind(sequence),
        this.getRange(sequence),
        this.getRange(sequence),
        children,
      ),
    ];
  }

  private getSymbolKind(node: YAMLNode): SymbolKind {
    if (!node) {
      return SymbolKind.Field;
    } else if (node.kind === Kind.MAP) {
      return SymbolKind.Enum;
    } else if (node.kind === Kind.SEQ) {
      return SymbolKind.Array;
    } else if (node.kind === Kind.SCALAR) {
      if (node.value === null || node.valueObject === null) {
        return SymbolKind.Field;
      } else if (node.valueObject && typeof node.valueObject === 'number') {
        return SymbolKind.Number;
      } else if (typeof node.valueObject === 'boolean') {
        return SymbolKind.Boolean;
      } else {
        return SymbolKind.String;
      }
    } else if (node.kind === Kind.ANCHOR_REF && node.value) {
      return this.getSymbolKind(node.value);
    }

    return SymbolKind.Null;
  }

  private getKeyName(node: YAMLNode): string {
    if (!node || !node.key) {
      return '';
    }
    return node.key.value;
  }

  private getRange(node: YAMLNode): Range {
    return Range.create(
      this._doc.positionAt(node.startPosition),
      this._doc.positionAt(node.endPosition),
    );
  }
}

interface ITask {
  type: number;
  title: string | null;
  score: number;
  replicas: number;
}

export class ScoreOutline {
  private _taskTypes: string[] = ['suite', 'system', 'test:exec', 'test:ws'];
  private _taskTypeSymbol: SymbolKind[] = [
    SymbolKind.Constructor,
    SymbolKind.Field,
    SymbolKind.Property,
    SymbolKind.Constant,
  ];

  constructor(private _superDoc: SpecialDocument) {}

  public getOutline(): DocumentSymbol[] {
    const tasks = this.getTasksArray(load(this._superDoc.content));
    console.log(tasks);

    if (tasks) {
      return this.parseTasks(tasks)[0];
    }

    return [];
  }

  private getTasksArray(node: YAMLNode): YAMLSequence | null {
    let result: YAMLSequence | null = null;

    if (node.kind === Kind.MAP) {
      (node as YamlMap).mappings.forEach(mapping => {
        if (!mapping.value) {
          return;
        } else if (
          mapping.key.value === 'tasks' &&
          mapping.value.kind === Kind.SEQ
        ) {
          result = mapping.value as YAMLSequence;
        } else if (mapping.value.kind === Kind.ANCHOR_REF) {
          const tmpResult = this.getTasksArray(mapping.value.value);

          if (tmpResult && !result) {
            result = tmpResult;
          }
        }
      });
    }

    return result;
  }

  private parseTasks(node: YAMLSequence): [DocumentSymbol[], number] {
    const result: DocumentSymbol[] = [];

    let score: number = 0;

    node.items.forEach(item => {
      const subResult = this.parseGenericTask(item);

      if (subResult[0]) {
        result.push(subResult[0]);
        score += subResult[1];
      }
    });

    return [result, score];
  }

  private parseGenericTask(node: YAMLNode): [DocumentSymbol | null, number] {
    if (node.kind === Kind.MAP) {
      let result: ITask = {
        type: -1,
        title: null,
        score: 0,
        replicas: 0,
      };

      result = this.parseTaskMap(node, result);

      if (result.type < 0 || !result.title) {
        return [null, 0];
      }

      if (result.replicas > 0) {
        result.score = result.score * result.replicas;
      }

      let children: DocumentSymbol[] = [];

      const tasks = this.getTasksArray(node);

      if (result.type === 0 && tasks) {
        const suite = this.parseTasks(tasks);
        children = suite[0];
        result.score += suite[1];
      }

      return [
        DocumentSymbol.create(
          `${result.title}(${result.score})`,
          undefined,
          this._taskTypeSymbol[result.type],
          Range.create(Position.create(0, 0), Position.create(0, 0)),
          Range.create(Position.create(0, 0), Position.create(0, 0)),
          children,
        ),
        result.score,
      ];
    }

    return [null, 0];
  }

  private parseTaskMap(node: YAMLNode, result: ITask) {
    if (node.kind === Kind.MAP) {
      (node as YamlMap).mappings.forEach(mapping => {
        switch (mapping.key.value) {
          case 'type':
            result.type = this.getType(mapping.value);
            return;
          case 'title':
            result.title = this.getString(mapping.value);
            return;
          case 'score':
            result.score = this.getNumber(mapping.value);
            return;
          case 'replicas':
            result.replicas = this.getNumber(mapping.value);
            return;
          case '<<':
            result = this.parseTaskMap(mapping.value.value, result);
            return;
        }
      });
    }

    return result;
  }

  private getType(node: YAMLNode): number {
    const typeString = this.getString(node);

    let result = -1;

    if (!typeString) {
      return result;
    }

    this._taskTypes.forEach((taskType, index) => {
      if (taskType === typeString) {
        result = index;
      }
    });

    return result;
  }

  private getString(node: YAMLNode): string | null {
    if (node.kind !== Kind.SCALAR) {
      return null;
    }

    if (node.value === null || node.valueObject === null) {
      return null;
    } else if (node.valueObject && typeof node.valueObject === 'number') {
      return null;
    } else if (typeof node.valueObject === 'boolean') {
      return null;
    } else {
      return node.value;
    }
  }

  private getNumber(node: YAMLNode): number {
    if (node.kind !== Kind.SCALAR) {
      return 0;
    }

    if (node.value === null || node.valueObject === null) {
      return 0;
    } else if (node.valueObject && typeof node.valueObject === 'number') {
      return node.valueObject;
    }

    return 0;
  }
}
