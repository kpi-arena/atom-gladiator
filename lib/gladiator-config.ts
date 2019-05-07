import { readFile } from 'fs';
import { GlobSync } from 'glob';
import { join } from 'path';
import {
  Kind,
  safeLoad,
  YAMLAnchorReference,
  YamlMap,
  YAMLMapping,
  YAMLNode,
} from 'yaml-ast-parser';
import {
  CONFIG_FILE_NAME,
  getSchemaUri,
  PROBLEMSET_URL,
  VARIANTS_URL,
} from './gladiator-cli-adapter';

let configSchema: string | null = null;

export interface IConfigValues {
  apiUrl?: string;
  problemsetPath?: string;
  problemsetSchema?: string;
  variantsPath?: string;
  variantSchema?: string;
}

export function getConfigValues(path: string): Promise<IConfigValues> {
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

export function getAllConfigs(): Promise<string[]> {
  return new Promise<string[]>(resolve => {
    const result: string[] = [];

    atom.project.getPaths().forEach(projectPath => {
      const globResult = new GlobSync(`**/${CONFIG_FILE_NAME}`, {
        cwd: projectPath,
      });

      globResult.found.forEach(match => {
        result.push(join(projectPath, match));
      });
    });

    resolve(result);
  });
}

export function getConfigSchema(): string | null {
  if (!configSchema) {
    getSchemaUri()
      .then(value => {
        configSchema = value;
      })
      .catch(() => {
        configSchema = null;
      });
  }

  return configSchema;
}

function readConfigValues(node: YAMLNode): IConfigValues {
  const result: IConfigValues = {};

  const apiUrl = getValueFromKey(node, 'api-url');
  const problemsetPath = getValueFromKey(node, 'problemset-definition');
  const variantsPath = getValueFromKey(node, 'problemset-variants');

  result.apiUrl = apiUrl ? apiUrl : undefined;
  result.problemsetPath = problemsetPath ? problemsetPath : undefined;
  result.problemsetSchema = apiUrl ? `${apiUrl}${PROBLEMSET_URL}` : undefined;
  result.variantsPath = variantsPath ? variantsPath : undefined;
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
    result = result = getStringValue((node as YAMLMapping).value);
  }

  return result;
}

function getAnchorValue(node: YAMLAnchorReference): YAMLNode {
  if (node.value.kind !== Kind.ANCHOR_REF) {
    return node.value;
  } else {
    return getAnchorValue(node.value as YAMLAnchorReference);
  }
}

function getStringValue(node: YAMLNode): string | null {
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
