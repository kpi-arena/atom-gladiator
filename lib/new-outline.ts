import { DocumentSymbol } from 'vscode-languageserver-protocol';
import { Kind, load, YamlMap, YAMLNode, YAMLSequence } from 'yaml-ast-parser';
import { ILinesRelation } from './document-manager';

class ParseResult {
  public static createEmpty() {
    return new ParseResult([], 0);
  }

  constructor(private _children: DocumentSymbol[], private _score: number) {}

  public get children(): DocumentSymbol[] {
    return this._children;
  }

  public get score(): number {
    return this._score;
  }
}

export class SuperOutline {
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
    if (node.kind !== Kind.MAP) {
      return false;
    }

    let keywordRoot: YAMLSequence | null = null;

    (node as YamlMap).mappings.forEach(mapping => {
      if (
        mapping.key.value.match(this._mainKeywordRegex) &&
        mapping.value.kind === Kind.SEQ
      ) {
        keywordRoot = mapping.value as YAMLSequence;
      }
    });

    if (!keywordRoot) {
      return false;
    }

    // this.parseYamlSequence(keywordRoot);

    return true;
  }

  // private parseYamlNode(node: YAMLNode): ParseResult {
  //   if (!node) {
  //     return ParseResult.createEmpty();
  //   }

  //   switch (node.kind) {
  //     // case Kind.ANCHOR_REF:
  //     //   return this.parseYamlAnchorReference(
  //     //     node as YAMLAnchorReference,
  //     //     editor,
  //     //   );
  //     case Kind.MAP:
  //       return this.parseYamlMap(node as YamlMap);
  //     // case Kind.MAPPING:
  //     //   return this.parseYamlMapping(node as YAMLMapping, editor);
  //     // case Kind.SCALAR:
  //     //   return this.parseYamlScalar(node as YAMLScalar, editor);
  //     case Kind.SEQ:
  //       return this.parseYamlSequence(node as YAMLSequence);
  //     default:
  //       return ParseResult.createEmpty();
  //   }
  // }

  // private parseYamlMap(map: YamlMap): ParseResult {
  //   const result = ParseResult.createEmpty();

  //   map.mappings.forEach(mapping => {
  //     const mappingResult = this.parseYamlMapping(mapping);

  //     // result[0] = result[0].concat(childrenTuple[0]);

  //     // result[1] += childrenTuple[1];
  //   });

  //   return result;
  // }

  // private parseYamlSequence(seq: YAMLSequence): number {
  //   seq.items.forEach()
  // }
}
