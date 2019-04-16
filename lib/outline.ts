import { TextEditor } from 'atom';
import { Outline, OutlineTree, TokenKind } from 'atom-ide';
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

export class OutlineBuilder {
  private _testTypes: string[] = ['suite', 'system', 'test:exec', 'test:ws'];
  private _testColors: TokenKind[] = [
    'class-name',
    'constructor',
    'keyword',
    'param',
  ];

  public getOutline(editor: TextEditor): Promise<Outline | null> {
    return new Promise((resolve, reject) => {
      const yamlDoc = load(editor.getBuffer().getText());

      // console.log(yamlDoc);

      resolve({
        outlineTrees: this.parseYamlNode(yamlDoc as YamlMap, editor)[0],
      });
    });
  }

  private parseYamlNode(
    node: YAMLNode,
    editor: TextEditor,
  ): [OutlineTree[], number] {
    if (!node) {
      return [[], 0];
    }

    switch (node.kind) {
      case Kind.ANCHOR_REF:
        return this.parseYamlAnchorReference(
          node as YAMLAnchorReference,
          editor,
        );
      case Kind.MAP:
        return this.parseYamlMap(node as YamlMap, editor);
      case Kind.MAPPING:
        return this.parseYamlMapping(node as YAMLMapping, editor);
      case Kind.SCALAR:
        return this.parseYamlScalar(node as YAMLScalar, editor);
      case Kind.SEQ:
        return this.parseYamlSequence(node as YAMLSequence, editor);
      default:
        return [[], 0];
    }
  }

  private parseYamlAnchorReference(
    node: YAMLAnchorReference,
    editor: TextEditor,
  ): [OutlineTree[], number] {
    return this.parseYamlNode(node.value, editor);
  }

  private parseYamlMap(
    map: YamlMap,
    editor: TextEditor,
  ): [OutlineTree[], number] {
    const result: [OutlineTree[], number] = [[], 0];

    map.mappings.forEach(mapping => {
      const childrenTuple = this.parseYamlMapping(mapping, editor);

      result[0] = result[0].concat(childrenTuple[0]);

      result[1] += childrenTuple[1];
    });

    return result;
  }

  private parseYamlMapping(
    mapping: YAMLMapping,
    editor: TextEditor,
  ): [OutlineTree[], number] {
    const childrenTuple = this.parseYamlNode(mapping.value, editor);

    return [
      [
        {
          icon: this.getIcon(mapping.value),
          plainText: mapping.key.value,
          startPosition: editor
            .getBuffer()
            .positionForCharacterIndex(mapping.startPosition),
          endPosition: editor
            .getBuffer()
            .positionForCharacterIndex(mapping.endPosition),
          children: childrenTuple[0],
        },
      ],
      childrenTuple[1],
    ];
  }

  private parseYamlScalar(
    scalar: YAMLScalar,
    editor: TextEditor,
  ): [OutlineTree[], number] {
    return [[], 0];
  }

  private parseYamlSequence(
    sequence: YAMLSequence,
    editor: TextEditor,
  ): [OutlineTree[], number] {
    const result: [OutlineTree[], number] = [[], 0];

    sequence.items.forEach(node => {
      const testInfo = this.getTestInfo(node);

      const childrenTuple = this.parseYamlNode(node, editor);

      result[1] += testInfo[2] + childrenTuple[1];

      result[0].push({
        tokenizedText: [
          {
            kind: testInfo[1],
            value:
              testInfo[0] +
              (testInfo[2] + childrenTuple[1] > 0
                ? ' (' + (testInfo[2] + childrenTuple[1]) + ')'
                : ''),
          },
        ],
        startPosition: editor
          .getBuffer()
          .positionForCharacterIndex(node.startPosition),
        endPosition: editor
          .getBuffer()
          .positionForCharacterIndex(node.endPosition),
        children: childrenTuple[0],
      });
    });

    return result;
  }

  /* Helper methods. */
  private getIcon(node: YAMLNode): string {
    if (!node) {
      return 'type-variable';
    } else if (node.kind === Kind.MAP) {
      return 'type-module';
    } else if (node.kind === Kind.SEQ) {
      return 'type-array';
    } else if (node.kind === Kind.SCALAR) {
      if (!node.value || (node.valueObject && node.valueObject === null)) {
        return 'type-variable';
      } else if (node.valueObject && typeof node.valueObject === 'number') {
        return 'type-number';
      } else if (typeof node.valueObject === 'boolean') {
        return 'type-boolean';
      } else {
        return 'type-string';
      }
    }

    return '';
  }

  private getTestInfo(actualNode: YAMLNode): [string, TokenKind, number] {
    let node: YAMLNode;

    if (actualNode.kind === Kind.MAP) {
      node = actualNode as YamlMap;
    } else if (actualNode.kind === Kind.ANCHOR_REF) {
      node = actualNode.value as YAMLNode;
    } else {
      return ['', 'plain', 0];
    }

    const result: [string, TokenKind, number] = ['', 'plain', 0];

    let replicas = 0;

    for (const mapping of (node as YamlMap).mappings) {
      if (!mapping.key.value || !mapping.value.value) {
        continue;
      }

      switch (mapping.key.value) {
        case 'title':
          result[0] = mapping.value.value;
          break;
        case 'type':
          const typeIndex = this._testTypes.indexOf(mapping.value.value);

          if (typeIndex !== undefined) {
            result[1] = this._testColors[typeIndex];
          }
          break;

        case 'score':
          if (
            !(
              !mapping.value.valueObject &&
              typeof mapping.value.valueObject !== 'number'
            )
          ) {
            result[2] = mapping.value.valueObject;
          }
          break;

        case 'replicas':
          if (
            !(
              !mapping.value.valueObject &&
              typeof mapping.value.valueObject !== 'number'
            )
          ) {
            replicas = mapping.value.valueObject;
          }
          break;
      }
    }

    if (replicas > 0) {
      result[2] *= replicas;
    }

    return result;
  }
}

export class SingleFileOutline {
  constructor(private _doc: TextDocument) {}

  public parseFile(): DocumentSymbol[] {
    return this.parseYamlNode(load(this._doc.getText()));
  }

  public test(): DocumentSymbol[] {
    const result: DocumentSymbol[] = [];

    const r = Range.create(Position.create(0, 0), Position.create(0, 0));

    result.push(DocumentSymbol.create('', undefined, SymbolKind.Array, r, r));
    result.push(DocumentSymbol.create('', undefined, SymbolKind.Boolean, r, r));
    result.push(DocumentSymbol.create('', undefined, SymbolKind.Class, r, r));
    result.push(
      DocumentSymbol.create('', undefined, SymbolKind.Constant, r, r),
    );
    result.push(
      DocumentSymbol.create('', undefined, SymbolKind.Constructor, r, r),
    );
    result.push(DocumentSymbol.create('', undefined, SymbolKind.Enum, r, r));
    result.push(
      DocumentSymbol.create('', undefined, SymbolKind.EnumMember, r, r),
    );
    result.push(DocumentSymbol.create('', undefined, SymbolKind.Event, r, r));
    result.push(DocumentSymbol.create('', undefined, SymbolKind.Field, r, r));
    result.push(DocumentSymbol.create('', undefined, SymbolKind.File, r, r));
    result.push(
      DocumentSymbol.create('', undefined, SymbolKind.Function, r, r),
    );
    result.push(
      DocumentSymbol.create('', undefined, SymbolKind.Interface, r, r),
    );
    result.push(DocumentSymbol.create('', undefined, SymbolKind.Key, r, r));
    result.push(DocumentSymbol.create('', undefined, SymbolKind.Method, r, r));
    result.push(DocumentSymbol.create('', undefined, SymbolKind.Module, r, r));
    result.push(
      DocumentSymbol.create('', undefined, SymbolKind.Namespace, r, r),
    );
    result.push(DocumentSymbol.create('', undefined, SymbolKind.Null, r, r));
    result.push(DocumentSymbol.create('', undefined, SymbolKind.Number, r, r));
    result.push(DocumentSymbol.create('', undefined, SymbolKind.Object, r, r));
    result.push(
      DocumentSymbol.create('', undefined, SymbolKind.Operator, r, r),
    );
    result.push(DocumentSymbol.create('', undefined, SymbolKind.Package, r, r));
    result.push(
      DocumentSymbol.create('', undefined, SymbolKind.Property, r, r),
    );
    result.push(DocumentSymbol.create('', undefined, SymbolKind.String, r, r));
    result.push(DocumentSymbol.create('', undefined, SymbolKind.Struct, r, r));
    result.push(
      DocumentSymbol.create('', undefined, SymbolKind.TypeParameter, r, r),
    );
    result.push(
      DocumentSymbol.create('', undefined, SymbolKind.Variable, r, r),
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
    let children: DocumentSymbol[] = [];

    sequence.items.forEach(item => {
      children = children.concat(this.parseYamlNode(item));
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
      return SymbolKind.Null;
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
