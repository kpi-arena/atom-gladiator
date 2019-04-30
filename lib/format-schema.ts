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

export class FormatValidation {
  private _routes: Map<string, YAMLNode> = new Map();
  private _subpath: string = '';
  private _textDoc: TextDocument = TextDocument.create('', '', 0, '');

  constructor(private _schema: YAMLNode) {
    if (this._schema.kind === Kind.MAP) {
      (this._schema as YamlMap).mappings.forEach(mapping => {
        this._routes.set(mapping.key.value, mapping.value);
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

  /* Real stuff */
  private validate(node: YAMLNode, schema?: YAMLNode): Diagnostic[] {
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
      if (node.kind !== schema.kind) {
        return [];
      } else if (node.key) {
        if (!schema.key) {
          return [];
        } else {
          if ((node.key as YAMLNode).value !== (schema.key as YAMLNode).value) {
            return [];
          }
        }
      }
    }

    switch (node.kind) {
      case Kind.ANCHOR_REF:
        return this.validateAnchorReference(
          node as YAMLAnchorReference,
          schema,
        );
      case Kind.MAP:
        return this.validateMap(
          node as YamlMap,
          schema ? (schema as YamlMap) : schema,
        );
      case Kind.MAPPING:
        return this.validateMapping(
          node as YAMLMapping,
          schema ? (schema as YAMLMapping) : schema,
        );
      case Kind.SEQ:
        return this.validateSequence(
          node as YAMLSequence,
          schema ? (schema as YAMLSequence) : schema,
        );
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
    schema?: YAMLNode,
  ): Diagnostic[] {
    return this.validate(node.value, schema);
  }

  private validateMap(node: YamlMap, schema?: YamlMap): Diagnostic[] {
    let result: Diagnostic[] = [];

    if (!schema) {
      node.mappings.forEach(mapping => {
        result = result.concat(this.validate(mapping, schema));
      });
    } else {
      const schemaMap = new Map<string, YAMLNode>();

      schema.mappings.forEach(mapping => {
        schemaMap.set(mapping.key.value, mapping.value);
      });

      node.mappings.forEach(mapping => {
        const schemaMapping = schemaMap.get(mapping.key.value);

        if (schemaMapping) {
          result = result.concat(this.validate(mapping.value, schemaMapping));
        }
      });
    }

    return result;
  }

  private validateMapping(
    node: YAMLMapping,
    schema?: YAMLMapping,
  ): Diagnostic[] {
    return this.validate(node.value, schema ? schema.value : schema);
  }

  private validateSequence(
    node: YAMLSequence,
    schema?: YAMLSequence,
  ): Diagnostic[] {
    let result: Diagnostic[] = [];

    if (!schema) {
      node.items.forEach(item => {
        result = result.concat(this.validate(item, schema));
      });
    } else {
      const schemaSequence = new Map<string, YAMLNode>();
      let validateScalars: boolean = false;

      schema.items.forEach(item => {
        if (
          item.kind === Kind.SCALAR &&
          (item.value as YAMLNode).value === '$'
        ) {
          validateScalars = true;
        } else if (item.kind === Kind.MAP) {
          schemaSequence.set(item.mappings[0].key.value, item.value);
        }
      });

      node.items.forEach(item => {
        if (validateScalars && item.kind === Kind.SCALAR) {
          result = result.concat(this.validateScalar(item as YAMLScalar));

          return;
        }

        const schemaItem = schemaSequence.get((item.key as YAMLNode).value);

        if (schemaItem) {
          result = result.concat(this.validate(item, schemaItem));
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
