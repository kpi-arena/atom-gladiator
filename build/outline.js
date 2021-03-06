"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const atom_languageclient_1 = require("atom-languageclient");
const path_1 = require("path");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const yaml_ast_parser_1 = require("yaml-ast-parser");
const util_1 = require("./util");
class SingleFileOutline {
    constructor(_doc) {
        this._doc = _doc;
    }
    getOutline() {
        return this.parseYamlNode(yaml_ast_parser_1.load(this._doc.getText()));
    }
    test() {
        const result = [];
        const r = vscode_languageserver_protocol_1.Range.create(vscode_languageserver_protocol_1.Position.create(0, 0), vscode_languageserver_protocol_1.Position.create(0, 0));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Array', undefined, vscode_languageserver_protocol_1.SymbolKind.Array, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Boolean', undefined, vscode_languageserver_protocol_1.SymbolKind.Boolean, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Class', undefined, vscode_languageserver_protocol_1.SymbolKind.Class, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Constant', undefined, vscode_languageserver_protocol_1.SymbolKind.Constant, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Constructor', undefined, vscode_languageserver_protocol_1.SymbolKind.Constructor, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Enum', undefined, vscode_languageserver_protocol_1.SymbolKind.Enum, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('EnumMember', undefined, vscode_languageserver_protocol_1.SymbolKind.EnumMember, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Event', undefined, vscode_languageserver_protocol_1.SymbolKind.Event, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Field', undefined, vscode_languageserver_protocol_1.SymbolKind.Field, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('File', undefined, vscode_languageserver_protocol_1.SymbolKind.File, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Function', undefined, vscode_languageserver_protocol_1.SymbolKind.Function, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Interface', undefined, vscode_languageserver_protocol_1.SymbolKind.Interface, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Key', undefined, vscode_languageserver_protocol_1.SymbolKind.Key, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Method', undefined, vscode_languageserver_protocol_1.SymbolKind.Method, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Module', undefined, vscode_languageserver_protocol_1.SymbolKind.Module, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Namespace', undefined, vscode_languageserver_protocol_1.SymbolKind.Namespace, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Null', undefined, vscode_languageserver_protocol_1.SymbolKind.Null, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Number', undefined, vscode_languageserver_protocol_1.SymbolKind.Number, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Object', undefined, vscode_languageserver_protocol_1.SymbolKind.Object, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Operator', undefined, vscode_languageserver_protocol_1.SymbolKind.Operator, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Package', undefined, vscode_languageserver_protocol_1.SymbolKind.Package, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Property', undefined, vscode_languageserver_protocol_1.SymbolKind.Property, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('String', undefined, vscode_languageserver_protocol_1.SymbolKind.String, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Struct', undefined, vscode_languageserver_protocol_1.SymbolKind.Struct, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('TypeParameter', undefined, vscode_languageserver_protocol_1.SymbolKind.TypeParameter, r, r));
        result.push(vscode_languageserver_protocol_1.DocumentSymbol.create('Variable', undefined, vscode_languageserver_protocol_1.SymbolKind.Variable, r, r));
        return result;
    }
    parseYamlNode(node) {
        if (!node) {
            return [];
        }
        switch (node.kind) {
            case yaml_ast_parser_1.Kind.ANCHOR_REF:
                return this.parseYamlAnchorReference(node);
            case yaml_ast_parser_1.Kind.MAP:
                return this.parseYamlMap(node);
            case yaml_ast_parser_1.Kind.MAPPING:
                return this.parseYamlMapping(node);
            case yaml_ast_parser_1.Kind.SCALAR:
                return this.parseYamlScalar(node);
            case yaml_ast_parser_1.Kind.SEQ:
                return this.parseYamlSequence(node);
            default:
                return [];
        }
    }
    parseYamlAnchorReference(node) {
        return this.parseYamlNode(node.value);
    }
    parseYamlMap(map) {
        let children = [];
        map.mappings.forEach(mapping => {
            const parsedMapping = this.parseYamlMapping(mapping);
            children = children.concat(parsedMapping);
        });
        if (!map.key) {
            return children;
        }
        return [
            vscode_languageserver_protocol_1.DocumentSymbol.create(this.getKeyName(map), undefined, vscode_languageserver_protocol_1.SymbolKind.Object, this.getRange(map), this.getRange(map), children),
        ];
    }
    parseYamlMapping(mapping) {
        return [
            vscode_languageserver_protocol_1.DocumentSymbol.create(this.getKeyName(mapping), undefined, this.getSymbolKind(mapping.value), this.getRange(mapping), this.getRange(mapping), this.parseYamlNode(mapping.value)),
        ];
    }
    parseYamlScalar(scalar) {
        return [];
    }
    parseYamlSequence(sequence) {
        const children = [];
        sequence.items.forEach((item, index) => {
            children.push(vscode_languageserver_protocol_1.DocumentSymbol.create(`(${index})`, undefined, vscode_languageserver_protocol_1.SymbolKind.Module, this.getRange(item), this.getRange(item), this.parseYamlNode(item)));
            // children = children.concat(this.parseYamlNode(item));
        });
        if (!sequence.key) {
            return children;
        }
        return [
            vscode_languageserver_protocol_1.DocumentSymbol.create(this.getKeyName(sequence), undefined, this.getSymbolKind(sequence), this.getRange(sequence), this.getRange(sequence), children),
        ];
    }
    getSymbolKind(node) {
        if (!node) {
            return vscode_languageserver_protocol_1.SymbolKind.Field;
        }
        else if (node.kind === yaml_ast_parser_1.Kind.MAP) {
            return vscode_languageserver_protocol_1.SymbolKind.Enum;
        }
        else if (node.kind === yaml_ast_parser_1.Kind.SEQ) {
            return vscode_languageserver_protocol_1.SymbolKind.Array;
        }
        else if (node.kind === yaml_ast_parser_1.Kind.SCALAR) {
            if (node.value === null || node.valueObject === null) {
                return vscode_languageserver_protocol_1.SymbolKind.Field;
            }
            else if (node.valueObject && typeof node.valueObject === 'number') {
                return vscode_languageserver_protocol_1.SymbolKind.Number;
            }
            else if (typeof node.valueObject === 'boolean') {
                return vscode_languageserver_protocol_1.SymbolKind.Boolean;
            }
            else {
                return vscode_languageserver_protocol_1.SymbolKind.String;
            }
        }
        else if (node.kind === yaml_ast_parser_1.Kind.ANCHOR_REF && node.value) {
            return this.getSymbolKind(node.value);
        }
        return vscode_languageserver_protocol_1.SymbolKind.Null;
    }
    getKeyName(node) {
        if (!node || !node.key) {
            return '';
        }
        return node.key.value;
    }
    getRange(node) {
        return vscode_languageserver_protocol_1.Range.create(this._doc.positionAt(node.startPosition), this._doc.positionAt(node.endPosition));
    }
}
exports.SingleFileOutline = SingleFileOutline;
class ScoreOutline {
    constructor(_superDoc) {
        this._superDoc = _superDoc;
        this._taskTypes = [
            'suite',
            'system',
            'test:exec',
            'test:ws',
        ];
        this._taskTypeSymbol = [
            vscode_languageserver_protocol_1.SymbolKind.Constructor,
            vscode_languageserver_protocol_1.SymbolKind.Field,
            vscode_languageserver_protocol_1.SymbolKind.Property,
            vscode_languageserver_protocol_1.SymbolKind.Constant,
        ];
        this._result = new Map();
        this._superDoc.relatedUris.forEach(relatedUri => {
            this._result.set(relatedUri, []);
        });
        this._textDoc = vscode_languageserver_protocol_1.TextDocument.create(atom_languageclient_1.Convert.pathToUri(this._superDoc.rootPath), util_1.LANGUAGE_ID, 0, _superDoc.content);
        const rootNode = yaml_ast_parser_1.load(this._superDoc.content);
        const tasks = this.getTasksArray(rootNode);
        if (tasks) {
            const totalTasks = this.parseTasks(tasks, atom_languageclient_1.Convert.pathToUri(this._superDoc.rootPath));
            this._result.set(atom_languageclient_1.Convert.pathToUri(this._superDoc.rootPath), [
                vscode_languageserver_protocol_1.DocumentSymbol.create(`${this.getTitle(rootNode)} (${totalTasks[1]})`, undefined, vscode_languageserver_protocol_1.SymbolKind.Class, vscode_languageserver_protocol_1.Range.create(vscode_languageserver_protocol_1.Position.create(0, 0), vscode_languageserver_protocol_1.Position.create(0, 0)), vscode_languageserver_protocol_1.Range.create(vscode_languageserver_protocol_1.Position.create(0, 0), vscode_languageserver_protocol_1.Position.create(0, 0)), totalTasks[0]),
            ]);
        }
    }
    getOutline(uri) {
        if (this._result.has(uri)) {
            return this._result.get(uri);
        }
        else {
            return [];
        }
    }
    getTitle(node) {
        let result = 'TOTAL';
        if (node.kind === yaml_ast_parser_1.Kind.MAP) {
            node.mappings.forEach(mapping => {
                if (!mapping.value) {
                    return;
                }
                else if (mapping.key.value === 'title' &&
                    mapping.value.kind === yaml_ast_parser_1.Kind.SCALAR) {
                    result = mapping.value.value;
                }
                else if (mapping.key.value === 'pid' &&
                    mapping.value.kind === yaml_ast_parser_1.Kind.SCALAR) {
                    result = mapping.value.value;
                }
            });
        }
        return result;
    }
    getTasksArray(node) {
        let result = null;
        if (node.kind === yaml_ast_parser_1.Kind.MAP) {
            node.mappings.forEach(mapping => {
                if (!mapping.value) {
                    return;
                }
                else if (mapping.key.value === 'tasks' &&
                    mapping.value.kind === yaml_ast_parser_1.Kind.SEQ) {
                    result = mapping.value;
                }
                else if (mapping.value.kind === yaml_ast_parser_1.Kind.ANCHOR_REF) {
                    const tmpResult = this.getTasksArray(mapping.value.value);
                    if (tmpResult && !result) {
                        result = tmpResult;
                    }
                }
            });
        }
        return result;
    }
    parseTasks(node, previousUri) {
        const result = [];
        let score = 0;
        node.items.forEach(item => {
            const subResult = this.parseGenericTask(item, previousUri);
            if (subResult[0]) {
                result.push(subResult[0]);
                score += subResult[1];
            }
        });
        return [result, score];
    }
    parseGenericTask(node, previousUri) {
        if (node.kind === yaml_ast_parser_1.Kind.MAP) {
            let result = {
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
            }
            else if (result.replicas > 0) {
                result.score = result.score * result.replicas;
            }
            const currentUri = this._superDoc.getOriginUri(this._textDoc.positionAt(node.startPosition).line);
            const range = this._superDoc.transformRange(vscode_languageserver_protocol_1.Range.create(this._textDoc.positionAt(node.startPosition), this._textDoc.positionAt(node.endPosition)));
            let children = [];
            const tasks = this.getTasksArray(node);
            if (result.type === 0 && tasks) {
                const suite = this.parseTasks(tasks, currentUri);
                children = suite[0];
                result.score += suite[1];
            }
            if (currentUri !== previousUri) {
                const currentResult = this._result.get(currentUri);
                currentResult.push(vscode_languageserver_protocol_1.DocumentSymbol.create(`${result.title} (${result.score})`, undefined, this._taskTypeSymbol[result.type], range, range, children));
                const include = this.getPreviousInclude(this._textDoc.positionAt(node.startPosition).line);
                return [
                    vscode_languageserver_protocol_1.DocumentSymbol.create(`${include[1]} (${result.score})`, undefined, vscode_languageserver_protocol_1.SymbolKind.String, include[0], include[0], []),
                    result.score,
                ];
            }
            else {
                return [
                    vscode_languageserver_protocol_1.DocumentSymbol.create(`${result.title} (${result.score})`, undefined, this._taskTypeSymbol[result.type], range, range, children),
                    result.score,
                ];
            }
        }
        return [null, 0];
    }
    parseTaskMap(node, result) {
        if (node.kind === yaml_ast_parser_1.Kind.MAP) {
            let anchor = null;
            node.mappings.forEach(mapping => {
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
    getType(node) {
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
    getString(node) {
        if (!node) {
            return null;
        }
        else if (node.kind !== yaml_ast_parser_1.Kind.SCALAR) {
            return null;
        }
        if (node.value === null || node.valueObject === null) {
            return null;
        }
        else if (node.valueObject && typeof node.valueObject === 'number') {
            return null;
        }
        else if (typeof node.valueObject === 'boolean') {
            return null;
        }
        else {
            return node.value;
        }
    }
    getNumber(node) {
        if (!node) {
            return 0;
        }
        else if (node.kind !== yaml_ast_parser_1.Kind.SCALAR) {
            return 0;
        }
        if (!node.value || !node.valueObject) {
            return 0;
        }
        else if (node.valueObject && typeof node.valueObject === 'number') {
            return node.valueObject;
        }
        return 0;
    }
    getPreviousInclude(refLine) {
        let previous = -1;
        for (const line of this._superDoc.includes.keys()) {
            if (line < refLine) {
                previous = line;
            }
        }
        if (previous < 0) {
            return [
                this._superDoc.transformRange(vscode_languageserver_protocol_1.Range.create(vscode_languageserver_protocol_1.Position.create(0, 0), vscode_languageserver_protocol_1.Position.create(0, 99))),
                'INCLUDE',
            ];
        }
        return [
            this._superDoc.transformRange(vscode_languageserver_protocol_1.Range.create(vscode_languageserver_protocol_1.Position.create(previous, 0), vscode_languageserver_protocol_1.Position.create(previous, 99))),
            this.getRelativePath(path_1.dirname(this._superDoc.rootPath), this._superDoc.includes.get(previous)),
        ];
    }
    getRelativePath(source, target) {
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
exports.ScoreOutline = ScoreOutline;
//# sourceMappingURL=outline.js.map