import { existsSync } from 'fs';
import { join } from 'path';
import {
  Diagnostic,
  Range,
  TextDocument,
} from 'vscode-languageserver-protocol';
import {
  Kind,
  YAMLAnchorReference,
  YamlMap,
  YAMLMapping,
  YAMLNode,
  YAMLScalar,
  YAMLSequence,
} from 'yaml-ast-parser';
/* 
package:
  - $
  - orig-file: $
  - directory:
      into: $
      include:
        - $
      exclude:
        - $
problemset-definition: $
problemset-variants: $
*/

class SchemaNode {
  private _kind: Kind;
  private _key: string | null;
  private _value: SchemaNode | null;
  private _mappings: Map<string, SchemaNode> = new Map();
  private _items: Map<string, SchemaNode> = new Map();
  private _validateScalars: boolean = false;

  constructor(node: YAMLNode) {
    this._kind = node.kind;

    this._key = node.key ? (node.key as YAMLNode).value : null;

    this._value =
      node.kind === Kind.MAPPING ? new SchemaNode(node.value) : null;

    switch (node.kind) {
      case Kind.MAP:
        (node as YamlMap).mappings.forEach(mapping => {
          this._mappings.set(mapping.key.value, new SchemaNode(mapping));
        });
        break;

      case Kind.SEQ:
        (node as YAMLSequence).items.forEach(item => {
          if (item.kind === Kind.SCALAR && item.value === '$') {
            this._validateScalars = true;
          } else if (item.kind === Kind.MAP) {
            (item as YamlMap).mappings.forEach(mapping => {
              this._items.set(mapping.key.value, new SchemaNode(mapping));
            });
          }
        });
        break;
    }
  }

  public validateNode(node: YAMLNode): boolean {
    if (node.kind !== this._kind) {
      return false;
    } else if (node.key) {
      if (!this._key) {
        return false;
      } else {
        if ((node.key as YAMLNode).value !== this._key) {
          return false;
        }
      }
    }

    return true;
  }

  public get kind(): Kind {
    return this._kind;
  }

  public get key(): string | null {
    return this._key;
  }

  public get value(): SchemaNode | null {
    return this._value;
  }

  public get mappings(): Map<string, SchemaNode> {
    return this._mappings;
  }

  public get items(): Map<string, SchemaNode> {
    return this._items;
  }

  public get validateScalars(): boolean {
    return this._validateScalars;
  }
}

export class FormatValidation {
  private _routes: Map<string, SchemaNode> = new Map();
  private _subpath: string = '';
  private _textDoc: TextDocument = TextDocument.create('', '', 0, '');

  constructor(private _schema: YAMLNode) {
    if (this._schema.kind === Kind.MAP) {
      (this._schema as YamlMap).mappings.forEach(mapping => {
        this._routes.set(mapping.key.value, new SchemaNode(mapping.value));
      });
    }
  }

  public set subPath(subPath: string) {
    this._subpath = subPath;
  }

  public set doc(doc: TextDocument) {
    this._textDoc = doc;
  }

  public getDiagnostics(node: YAMLNode): Diagnostic[] {
    return this.validate(node);
  }

  private validate(node: YAMLNode, schema?: SchemaNode): Diagnostic[] {
    if (!schema) {
      if (!node) {
        return [];
      }

      if (node.key) {
        const route = this._routes.get((node.key as YAMLNode).value);

        if (route) {
          return this.validate(node.value, route);
        }
      }
    } else {
      if (!schema.validateNode(node)) {
        return [];
      }
    }

    switch (node.kind) {
      case Kind.ANCHOR_REF:
        return this.validateAnchorReference(
          node as YAMLAnchorReference,
          schema,
        );
      case Kind.MAP:
        return this.validateMap(node as YamlMap, schema);
      case Kind.MAPPING:
        return this.validateMapping(node as YAMLMapping, schema);
      case Kind.SEQ:
        return this.validateSequence(node as YAMLSequence, schema);
      case Kind.SCALAR:
        if (schema) {
          return this.validateScalar(node as YAMLScalar);
        }

      default:
        return [];
    }
  }

  private validateAnchorReference(
    node: YAMLAnchorReference,
    schema?: SchemaNode,
  ): Diagnostic[] {
    return this.validate(node.value, schema);
  }

  private validateMap(node: YamlMap, schema?: SchemaNode): Diagnostic[] {
    let result: Diagnostic[] = [];

    if (!schema) {
      node.mappings.forEach(mapping => {
        result = result.concat(this.validate(mapping, schema));
      });
    } else {
      node.mappings.forEach(mapping => {
        const schemaMapping = schema.mappings.get(mapping.key.value);

        if (schemaMapping) {
          result = result.concat(this.validate(mapping.value, schemaMapping));
        }
      });
    }

    return result;
  }

  private validateMapping(
    node: YAMLMapping,
    schema?: SchemaNode,
  ): Diagnostic[] {
    if (!schema) {
      return this.validate(node.value);
    } else if (schema.value) {
      return this.validate(node.value, schema.value);
    } else {
      return [];
    }
  }

  private validateSequence(
    node: YAMLSequence,
    schema?: SchemaNode,
  ): Diagnostic[] {
    let result: Diagnostic[] = [];

    if (!schema) {
      node.items.forEach(item => {
        result = result.concat(this.validate(item, schema));
      });
    } else {
      node.items.forEach(item => {
        if (schema.validateScalars && item.kind === Kind.SCALAR) {
          result = result.concat(this.validateScalar(item as YAMLScalar));

          return;
        } else if (item.key) {
          const schemaItem = schema.items.get((item.key as YAMLNode).value);

          if (schemaItem) {
            result = result.concat(this.validate(item, schemaItem));
          }
        }
      });
    }

    return result;
  }

  private validateScalar(node: YAMLScalar): Diagnostic[] {
    if (existsSync(join(this._subpath, node.value))) {
      return [];
    } else {
      return [
        Diagnostic.create(
          Range.create(
            this._textDoc.positionAt(node.startPosition),
            this._textDoc.positionAt(node.endPosition),
          ),
          'File not found.',
          1,
        ),
      ];
    }
  }
}
