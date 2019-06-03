import { Convert } from 'atom-languageclient';
import { dirname } from 'path';
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
import { ComposedDocument } from './special-document';
import { LANGUAGE_ID } from './util';

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
  type?: number;
  title?: string | null;
  score: number;
  replicas: number;
}

export class ScoreOutline {
  private readonly _taskTypes: string[] = [
    'suite',
    'system',
    'test:exec',
    'test:ws',
  ];
  private readonly _taskTypeSymbol: SymbolKind[] = [
    SymbolKind.Constructor,
    SymbolKind.Field,
    SymbolKind.Property,
    SymbolKind.Constant,
  ];
  private _result: Map<string, DocumentSymbol[]> = new Map();
  private _textDoc: TextDocument;

  constructor(private _superDoc: ComposedDocument) {
    this._superDoc.relatedUris.forEach(relatedUri => {
      this._result.set(relatedUri, []);
    });

    this._textDoc = TextDocument.create(
      Convert.pathToUri(this._superDoc.rootPath),
      LANGUAGE_ID,
      0,
      _superDoc.content,
    );

    const rootNode = load(this._superDoc.content);

    const tasks = this.getTasksArray(rootNode);

    if (tasks) {
      const totalTasks = this.parseTasks(
        tasks,
        Convert.pathToUri(this._superDoc.rootPath),
      );

      this._result.set(Convert.pathToUri(this._superDoc.rootPath), [
        DocumentSymbol.create(
          `${this.getTitle(rootNode)}: ${totalTasks[1]}`,
          undefined,
          SymbolKind.Class,
          Range.create(Position.create(0, 0), Position.create(0, 0)),
          Range.create(Position.create(0, 0), Position.create(0, 0)),
          totalTasks[0],
        ),
      ]);
    }
  }

  public getOutline(uri: string): DocumentSymbol[] {
    if (this._result.has(uri)) {
      return this._result.get(uri) as DocumentSymbol[];
    } else {
      return [];
    }
  }

  private getTitle(node: YAMLNode): string {
    let result: string = 'TOTAL';

    if (node.kind === Kind.MAP) {
      (node as YamlMap).mappings.forEach(mapping => {
        if (!mapping.value) {
          return;
        } else if (
          mapping.key.value === 'title' &&
          mapping.value.kind === Kind.SCALAR
        ) {
          result = mapping.value.value as string;
        }
      });
    }

    return result;
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

  private parseTasks(
    node: YAMLSequence,
    previousUri: string,
  ): [DocumentSymbol[], number] {
    const result: DocumentSymbol[] = [];

    let score: number = 0;

    node.items.forEach(item => {
      const subResult = this.parseGenericTask(item, previousUri);

      if (subResult[0]) {
        result.push(subResult[0]);
        score += subResult[1];
      }
    });

    return [result, score];
  }

  private parseGenericTask(
    node: YAMLNode,
    previousUri: string,
  ): [DocumentSymbol | null, number] {
    if (node.kind === Kind.MAP) {
      let result: ITask = {
        score: -1,
        replicas: -1,
      };

      result = this.parseTaskMap(node, result);

      if (result.type === undefined || !result.title) {
        return [null, 0];
      }

      if (result.type < 0 || !result.title) {
        return [null, 0];
      }

      if (result.score === -1) {
        result.score = 0;
      } else if (result.replicas > 0) {
        result.score = result.score * result.replicas;
      }

      const currentUri = this._superDoc.getOriginUri(
        this._textDoc.positionAt(node.startPosition).line,
      );

      const range = this._superDoc.transformRange(
        Range.create(
          this._textDoc.positionAt(node.startPosition),
          this._textDoc.positionAt(node.endPosition),
        ),
      );

      let children: DocumentSymbol[] = [];

      const tasks = this.getTasksArray(node);

      if (result.type === 0 && tasks) {
        const suite = this.parseTasks(tasks, currentUri);
        children = suite[0];
        result.score += suite[1];
      }

      if (currentUri !== previousUri) {
        const currentResult = this._result.get(currentUri) as DocumentSymbol[];

        currentResult.push(
          DocumentSymbol.create(
            `${result.title} (${result.score})`,
            undefined,
            this._taskTypeSymbol[result.type],
            range,
            range,
            children,
          ),
        );

        const include = this.getPreviousInclude(
          this._textDoc.positionAt(node.startPosition).line,
        );

        return [
          DocumentSymbol.create(
            `${include[1]} (${result.score})`,
            undefined,
            SymbolKind.String,
            include[0],
            include[0],
            [],
          ),
          result.score,
        ];
      } else {
        return [
          DocumentSymbol.create(
            `${result.title} (${result.score})`,
            undefined,
            this._taskTypeSymbol[result.type],
            range,
            range,
            children,
          ),
          result.score,
        ];
      }
    }

    return [null, 0];
  }

  private parseTaskMap(node: YAMLNode, result: ITask) {
    if (node.kind === Kind.MAP) {
      let anchor: YAMLNode | null = null;

      (node as YamlMap).mappings.forEach(mapping => {
        switch (mapping.key.value) {
          case 'type':
            if (result.type === undefined) {
              result.type = this.getType(mapping.value);
            }
            return;
          case 'title':
            if (!result.title) {
              result.title = this.getString(mapping.value);
            }
            return;
          case 'score':
            if (result.score < 0) {
              result.score = this.getNumber(mapping.value);
            }
            return;
          case 'replicas':
            if (result.replicas < 0) {
              result.replicas = this.getNumber(mapping.value);
            }
            return;
          case '<<':
            anchor = mapping.value.value;
            return;
        }
      });

      if (anchor) {
        result = this.parseTaskMap(anchor, result);
      }
    }

    return result;
  }

  private getType(node: YAMLNode): number {
    if (!node) {
      return -1;
    }
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
    if (!node) {
      return null;
    } else if (node.kind !== Kind.SCALAR) {
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
    if (!node) {
      return 0;
    } else if (node.kind !== Kind.SCALAR) {
      return 0;
    }

    if (!node.value || !node.valueObject) {
      return 0;
    } else if (node.valueObject && typeof node.valueObject === 'number') {
      return node.valueObject;
    }

    return 0;
  }

  private getPreviousInclude(refLine: number): [Range, string] {
    let previous = -1;

    for (const line of this._superDoc.includes.keys()) {
      if (line < refLine) {
        previous = line;
      }
    }

    if (previous < 0) {
      return [
        this._superDoc.transformRange(
          Range.create(Position.create(0, 0), Position.create(0, 99)),
        ),
        'INCLUDE',
      ];
    }

    return [
      this._superDoc.transformRange(
        Range.create(
          Position.create(previous, 0),
          Position.create(previous, 99),
        ),
      ),
      this.getRelativePath(
        dirname(this._superDoc.rootPath),
        this._superDoc.includes.get(previous) as string,
      ),
    ];
  }

  private getRelativePath(source: string, target: string) {
    const sep = source.indexOf('/') !== -1 ? '/' : '\\';
    const targetArr = target.split(sep);
    const sourceArr = source.split(sep);
    const filename = targetArr.pop();
    const targetPath = targetArr.join(sep);
    let relativePath = '';

    while (targetPath.indexOf(sourceArr.join(sep)) === -1) {
      sourceArr.pop();
      relativePath += '..' + sep;
    }

    const relPathArr = targetArr.slice(sourceArr.length);
    if (relPathArr.length > 0) {
      relativePath += relPathArr.join(sep) + sep;
    }

    return relativePath + filename;
  }
}
