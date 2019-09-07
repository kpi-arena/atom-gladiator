"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const atom_languageclient_1 = require("atom-languageclient");
const path_1 = require("path");
const yaml_ast_parser_1 = require("yaml-ast-parser");
const composed_document_1 = require("./composed-document");
const format_schema_1 = require("./format-schema");
const gladiator_cli_adapter_1 = require("./gladiator-cli-adapter");
const outline_1 = require("./outline");
const util_1 = require("./util");
class GladiatorConnection extends atom_languageclient_1.LanguageClientConnection {
    constructor(rpc, format, logger) {
        super(rpc, logger);
        this._docs = new Map();
        this._versions = new Map();
        this._format = null;
        this._scoreOutlineDocs = new Map();
        this._format = new format_schema_1.FormatValidation(yaml_ast_parser_1.safeLoad(format));
    }
    addSpecialDoc(doc, hasScore) {
        doc.relatedUris.forEach(relatedUri => {
            this._docs.set(relatedUri, doc);
        });
        if (hasScore) {
            this._scoreOutlineDocs.set(doc.rootPath, null);
        }
        this._versions.set(doc, 0);
        super.didOpenTextDocument(doc.getDidOpen());
    }
    isRelated(pathToCheck) {
        const uriToCheck = atom_languageclient_1.Convert.pathToUri(pathToCheck);
        for (const uri of this._docs.keys()) {
            if (uri === uriToCheck) {
                return true;
            }
        }
        return false;
    }
    set formatSubPath(subPath) {
        if (subPath && this._format) {
            this._format.subPath = subPath;
        }
    }
    deleteSpecialDocs() {
        this._docs.forEach(doc => {
            super.didCloseTextDocument(doc.getDidClose());
        });
        this._docs = new Map();
        this._versions = new Map();
        this._scoreOutlineDocs = new Map();
    }
    initialize(params) {
        // @ts-ignore
        return super.initialize(params).then(result => {
            result.capabilities.definitionProvider = true;
            return result;
        });
    }
    didOpenTextDocument(params) {
        if (!this._docs.has(params.textDocument.uri)) {
            super.didOpenTextDocument(params);
        }
    }
    didChangeTextDocument(params) {
        if (this._docs.has(params.textDocument.uri)) {
            const doc = this._docs.get(params.textDocument.uri);
            /* Calculating new version number and deleting the previous doc. */
            const version = this._versions.get(doc) + 1;
            this._versions.delete(doc);
            for (const uri of this._docs.keys()) {
                if (this._docs.get(uri) === doc) {
                    this._docs.delete(uri);
                }
            }
            const newDoc = new composed_document_1.ComposedDocument(doc.rootPath);
            newDoc.relatedUris.forEach(relatedUri => this._docs.set(relatedUri, newDoc));
            this._versions.set(newDoc, version);
            if (this._scoreOutlineDocs.has(doc.rootPath)) {
                this._scoreOutlineDocs.set(doc.rootPath, null);
            }
            super.didChangeTextDocument(newDoc.getDidChange(version));
        }
        else {
            super.didChangeTextDocument(params);
        }
    }
    willSaveTextDocument(params) {
        if (this._docs.has(params.textDocument.uri)) {
            return super.willSaveTextDocument(this._docs.get(params.textDocument.uri).getWillSave(params));
        }
        else {
            return super.willSaveTextDocument(params);
        }
    }
    willSaveWaitUntilTextDocument(params) {
        if (this._docs.has(params.textDocument.uri)) {
            const doc = this._docs.get(params.textDocument.uri);
            return super
                .willSaveWaitUntilTextDocument(doc.getWillSave(params))
                .then(value => {
                if (!value) {
                    return value;
                }
                return doc.transformTextEditArray(value);
            });
        }
        else {
            return super.willSaveWaitUntilTextDocument(params);
        }
    }
    didSaveTextDocument(params) {
        if (this._docs.has(params.textDocument.uri)) {
            super.didSaveTextDocument(this._docs.get(params.textDocument.uri).getDidSave(params));
        }
        else {
            super.didSaveTextDocument(params);
        }
    }
    didCloseTextDocument(params) {
        if (!this._docs.has(params.textDocument.uri)) {
            super.didCloseTextDocument(params);
        }
    }
    onPublishDiagnostics(callback) {
        const newCallback = (params) => {
            const paramsPath = atom_languageclient_1.Convert.uriToPath(params.uri);
            if (this._format && paramsPath.match(gladiator_cli_adapter_1.CONFIG_FILE_REGEX)) {
                const formatDoc = util_1.getOpenYAMLDocuments().get(paramsPath);
                if (formatDoc) {
                    this._format.subPath = path_1.dirname(paramsPath);
                    params.diagnostics = params.diagnostics.concat(this._format.getDiagnostics(yaml_ast_parser_1.safeLoad(formatDoc.getText()), formatDoc));
                }
                callback(params);
            }
            else if (this._docs.has(params.uri)) {
                this._docs.get(params.uri)
                    .filterDiagnostics(params)
                    .forEach(filteredParams => {
                    callback(filteredParams);
                });
            }
            else {
                callback(params);
            }
        };
        super.onPublishDiagnostics(newCallback);
    }
    completion(params, cancellationToken) {
        const doc = this._docs.get(params.textDocument.uri);
        if (doc) {
            return super.completion(doc.getCompletionParams(params), cancellationToken);
        }
        return super.completion(params, cancellationToken);
    }
    hover(params) {
        if (this._docs.has(params.textDocument.uri)) {
            return super.hover(this._docs.get(params.textDocument.uri).getTextDocumentPositionParams(params));
        }
        else {
            return super.hover(params);
        }
    }
    documentSymbol(params, cancellationToken) {
        const specDoc = this._docs.get(params.textDocument.uri);
        if (specDoc && this._scoreOutlineDocs.has(specDoc.rootPath)) {
            return new Promise(resolve => {
                let outline = this._scoreOutlineDocs.get(specDoc.rootPath);
                if (!outline) {
                    outline = new outline_1.ScoreOutline(specDoc);
                    this._scoreOutlineDocs.set(specDoc.rootPath, outline);
                }
                resolve(outline.getOutline(params.textDocument.uri));
            });
        }
        const doc = util_1.getOpenYAMLDocuments().get(atom_languageclient_1.Convert.uriToPath(params.textDocument.uri));
        if (doc) {
            return new Promise(resolve => {
                resolve(new outline_1.SingleFileOutline(doc).getOutline());
            });
        }
        else {
            return super.documentSymbol(params, cancellationToken);
        }
    }
    gotoDefinition(params) {
        if (this._docs.has(params.textDocument.uri)) {
            return new Promise((resolve, reject) => {
                const specLink = this._docs.get(params.textDocument.uri).getLocation(params);
                if (!specLink) {
                    reject();
                }
                else {
                    resolve(specLink);
                }
            });
        }
        else if (this._format &&
            params.textDocument.uri.match(gladiator_cli_adapter_1.CONFIG_FILE_REGEX)) {
            return new Promise(resolve => resolve(this._format.getLocations(params)));
        }
        else {
            return super.gotoDefinition(params);
        }
    }
}
exports.GladiatorConnection = GladiatorConnection;
//# sourceMappingURL=gladiator-connection.js.map