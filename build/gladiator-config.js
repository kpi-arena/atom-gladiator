"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const yaml_ast_parser_1 = require("yaml-ast-parser");
const gladiator_cli_adapter_1 = require("./gladiator-cli-adapter");
let configSchema = null;
function getConfigValues(path) {
    return new Promise((resolve, reject) => {
        fs_1.readFile(path, 'utf8', (err, data) => {
            if (err) {
                reject();
            }
            else {
                resolve(readConfigValues(yaml_ast_parser_1.safeLoad(data)));
            }
        });
    });
}
exports.getConfigValues = getConfigValues;
function getConfigSchema() {
    if (!configSchema) {
        gladiator_cli_adapter_1.getSchemaUri()
            .then(value => {
            configSchema = value;
        })
            .catch(() => {
            configSchema = null;
        });
    }
    return configSchema;
}
exports.getConfigSchema = getConfigSchema;
function readConfigValues(node) {
    const result = {};
    const apiUrl = getValueFromKey(node, 'api-url');
    const problemsetPath = getValueFromKey(node, 'problemset-definition');
    const variantsPath = getValueFromKey(node, 'problemset-variants');
    result.apiUrl = apiUrl ? apiUrl : undefined;
    result.problemsetPath = problemsetPath ? problemsetPath : 'problemset.yml';
    result.problemsetSchema = apiUrl ? `${apiUrl}${gladiator_cli_adapter_1.PROBLEMSET_URL}` : undefined;
    result.variantsPath = variantsPath ? variantsPath : 'problemset-variants.yml';
    result.variantSchema = apiUrl ? `${apiUrl}${gladiator_cli_adapter_1.VARIANTS_URL}` : undefined;
    return result;
}
function getValueFromKey(node, key) {
    let result = null;
    if (node.kind === yaml_ast_parser_1.Kind.MAP) {
        for (const mapping of node.mappings) {
            if (mapping.key.value === key) {
                result = getStringValue(mapping.value);
            }
        }
    }
    else if (node.kind === yaml_ast_parser_1.Kind.MAPPING &&
        node.key.value === key) {
        result = getStringValue(node.value);
    }
    return result;
}
function getStringValue(node) {
    if (!node) {
        return null;
    }
    else if (node.value === null || node.valueObject === null) {
        return null;
    }
    else if (node.kind !== yaml_ast_parser_1.Kind.SCALAR) {
        return null;
    }
    else if (!node.valueObject) {
        return node.value;
    }
    else {
        return null;
    }
}
