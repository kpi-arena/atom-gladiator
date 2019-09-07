import { readFile } from 'fs';
import {
  Kind,
  safeLoad,
  YamlMap,
  YAMLMapping,
  YAMLNode,
} from 'yaml-ast-parser';
import {
  PROBLEMSET_URL,
  VARIANTS_URL,
} from './gladiator-cli-adapter';

export interface IConfigValues {
  apiUrl?: string;
  problemsetPath?: string;
  problemsetSchema?: string;
  variantsPath?: string;
  variantSchema?: string;
}

export async function getConfigValues(path: string): Promise<IConfigValues> {
  return new Promise<IConfigValues>((resolve, reject) => {
    readFile(path, 'utf8', (err, data) => {
      if (err) {
        reject();
      } else {
        resolve(readConfigValues(safeLoad(data)));
      }
    });
  });
}

function readConfigValues(node: YAMLNode): IConfigValues {
  const result: IConfigValues = {};

  const apiUrl = getValueFromKey(node, 'api-url');
  const problemsetPath = getValueFromKey(node, 'problemset-definition');
  const variantsPath = getValueFromKey(node, 'problemset-variants');

  result.apiUrl = apiUrl ? apiUrl : undefined;
  result.problemsetPath = problemsetPath ? problemsetPath : 'problemset.yml';
  result.problemsetSchema = apiUrl ? `${apiUrl}${PROBLEMSET_URL}` : undefined;
  result.variantsPath = variantsPath ? variantsPath : 'problemset-variants.yml';
  result.variantSchema = apiUrl ? `${apiUrl}${VARIANTS_URL}` : undefined;

  return result;
}

function getValueFromKey(node: YAMLNode, key: string): string | null {
  let result = null;

  if (node.kind === Kind.MAP) {
    for (const mapping of (node as YamlMap).mappings) {
      if (mapping.key.value === key) {
        result = getStringValue(mapping.value);
      }
    }
  } else if (
    node.kind === Kind.MAPPING &&
    (node as YAMLMapping).key.value === key
  ) {
    result = getStringValue((node as YAMLMapping).value);
  }

  return result;
}

function getStringValue(node: YAMLNode): string | null {
  if (!node) {
    return null;
  } else if (node.value === null || node.valueObject === null) {
    return null;
  } else if (node.kind !== Kind.SCALAR) {
    return null;
  } else if (!node.valueObject) {
    return node.value;
  } else {
    return null;
  }
}
