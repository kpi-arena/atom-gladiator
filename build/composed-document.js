"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const atom_languageclient_1 = require("atom-languageclient");
const path = __importStar(require("path"));
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const include_error_1 = require("./include-error");
const util_1 = require("./util");
class ComposedDocument {
    constructor(_rootPath) {
        this._rootPath = _rootPath;
        this.INCLUDE_REGEX = /^(\cI|\t|\x20)*(#include ((\.|\\|\/|\w|-)+(\.yaml|\.yml)))(\cI|\t|\x20)*/;
        this._relatedUris = [];
        this._newToOld = [];
        this._oldToNew = new Map();
        this._includeErrors = [];
        this._includes = new Map();
        try {
            this._content = this.buildDocument('', _rootPath, '', util_1.getOpenYAMLDocuments(), []);
        }
        catch (err) {
            this._content = '';
        }
    }
    get content() {
        return this._content;
    }
    get relatedUris() {
        return this._relatedUris;
    }
    get rootPath() {
        return this._rootPath;
    }
    get includes() {
        return this._includes;
    }
    /**
     * Used when the document, or any of the subdocuments is opened. The params
     * are in context of the whole document, so diagnostics are returned for all
     * retlated files - use `filterDiagnostics` for filter them.
     */
    getDidOpen() {
        return {
            textDocument: {
                languageId: util_1.LANGUAGE_ID,
                text: this._content,
                uri: atom_languageclient_1.Convert.pathToUri(this._rootPath),
                version: 0,
            },
        };
    }
    getDidChange(docVer) {
        return {
            contentChanges: [{ text: this._content }],
            textDocument: {
                uri: atom_languageclient_1.Convert.pathToUri(this._rootPath),
                version: docVer,
            },
        };
    }
    getWillSave(params) {
        return {
            textDocument: {
                uri: atom_languageclient_1.Convert.pathToUri(this._rootPath),
            },
            reason: params.reason,
        };
    }
    /** Used when the document is saved. */
    getDidSave(params) {
        return {
            text: params.text,
            textDocument: {
                uri: atom_languageclient_1.Convert.pathToUri(this._rootPath),
                version: params.textDocument.version,
            },
        };
    }
    getDidClose() {
        return {
            textDocument: {
                uri: atom_languageclient_1.Convert.pathToUri(this._rootPath),
            },
        };
    }
    /**
     * Transforms params of the request to match their context in the curent
     * super document.
     *
     * @param params - parameters which have to be transformed.
     */
    getCompletionParams(params) {
        const result = this.getTextDocumentPositionParams(params);
        /* If 'params' are instance of CompletionParams add 'context' to the result. */
        if (this.instanceOfCompletionParams(params)) {
            result.context = params.context;
        }
        return result;
    }
    /**
     * Transforms the document's position to it's true position in the super
     * document, adds intendation of the document to the character position and
     * changes it's URI to to the URI of the root document.
     *
     * @param params - parameters sent from client containing positions and URI
     * of the original doc.
     */
    getTextDocumentPositionParams(params) {
        const lineRelation = this._oldToNew.get(params.position.line);
        if (lineRelation) {
            /* Iterating through 'ILinesRelation' array, in which each 'originalLine'
            is equal to the line from params. Only URI needs to be checked and when
            the corresponding one is found, position is changed according to the new
            position. */
            for (const item of lineRelation) {
                if (item.originUri === params.textDocument.uri) {
                    params.position.line = item.newLine;
                    params.position.character += item.indentationLength;
                    params.textDocument.uri = atom_languageclient_1.Convert.pathToUri(this._rootPath);
                    return params;
                }
            }
        }
        return params;
    }
    /**
     * Divides `params` into Map, in which the key is equal to the URI of the
     * original document and the value is a PublishDiagnosticsParams with tran-
     * slated document positions.
     *
     * @param params - all diagnostics for a super document.
     */
    filterDiagnostics(params) {
        const result = new Map();
        /* Initialize Map for each related subdocument with it's relatedUri as a
        key. Skipping this steps results in Diagnostics not clearing from editor
        if each Diagnostic is fixed by user. */
        this._relatedUris.forEach(relatedUri => {
            result.set(relatedUri, {
                uri: relatedUri,
                version: params.version,
                diagnostics: [],
            });
        });
        params.diagnostics.forEach(diagnose => {
            const startRelation = this._newToOld[diagnose.range.start.line];
            /* Push diagnostic of a document to diagnostics[] of the corresponding
            document, which is determined by URI. Also the range of the diagnostic
            are transformed to correspond with the original document's positions. */
            result.get(startRelation.originUri).diagnostics.push({
                code: diagnose.code,
                message: diagnose.message,
                range: this.transformRange(diagnose.range),
                relatedInformation: diagnose.relatedInformation,
                severity: diagnose.severity,
                source: diagnose.source,
            });
        });
        /* Push reference errors into diagnostics of the corresponding document. */
        this._includeErrors.forEach(err => {
            const correspondingDiagnostics = result.get(err.uri);
            if (correspondingDiagnostics) {
                correspondingDiagnostics.diagnostics.push(err.diagnostic);
            }
        });
        return result;
    }
    getLocation(params) {
        const realParams = this.getTextDocumentPositionParams(params);
        if (this._includes.has(realParams.position.line)) {
            return vscode_languageserver_protocol_1.Location.create(atom_languageclient_1.Convert.pathToUri(this._includes.get(realParams.position.line)), vscode_languageserver_protocol_1.Range.create(vscode_languageserver_protocol_1.Position.create(0, 0), vscode_languageserver_protocol_1.Position.create(0, 0)));
        }
        else {
            return null;
        }
    }
    /**
     * Transforms Range in every entry of `edits` to correspong to the actual
     * Range in original document.
     *
     * @param edits - array in which Range is transformed.
     */
    transformTextEditArray(edits) {
        edits.forEach(edit => {
            edit.range = this.transformRange(edit.range);
        });
        return edits;
    }
    /**
     * Transforms `superRange` from the super document to range in the one of
     * it's subdocuments. If the range ends outside of the subdocument, it's end
     * is set to the end of the subdocument. Transform also the intendation.
     *
     * @param superRange - range in the super document.
     */
    transformRange(superRange) {
        const startRelation = this._newToOld[superRange.start.line];
        let endRelation = this._newToOld[superRange.start.line];
        /* Going through '_newRelation' until the end of the super document is
        reacher, or the next line is not from the subdocument or the end line is
        found. */
        while (endRelation.newLine + 1 < this._newToOld.length &&
            this._newToOld[endRelation.newLine + 1].originUri ===
                startRelation.originUri &&
            superRange.end.line !== endRelation.newLine) {
            endRelation = this._newToOld[endRelation.newLine + 1];
        }
        /* When returning the corresponding range, indendation is substracted. */
        return {
            start: {
                line: startRelation.originLine,
                character: superRange.start.character - startRelation.indentationLength,
            },
            end: {
                line: endRelation.originLine,
                character: superRange.end.character - endRelation.indentationLength,
            },
        };
    }
    getOriginUri(line) {
        if (this._newToOld[line]) {
            return this._newToOld[line].originUri;
        }
        else {
            return atom_languageclient_1.Convert.pathToUri(this._rootPath);
        }
    }
    buildDocument(newContent, docPath, intendation, editorDocs, pathStack) {
        this._relatedUris.push(atom_languageclient_1.Convert.pathToUri(docPath));
        const doc = util_1.getBasicTextDocument(docPath, editorDocs);
        if (!doc) {
            throw new Error();
        }
        /* Checking if the file is already in stack, in case it is throw an error. */
        if (pathStack.indexOf(docPath) >= 0) {
            throw new Error('i');
        }
        pathStack.push(docPath);
        /* Using @ts-ignore to ignore the error, caused by accessing private method
        to obtain line offsets od the document. */
        // @ts-ignore
        const docOffsets = doc.getLineOffsets();
        for (let index = 0; index < docOffsets.length; index++) {
            let docLine;
            /* Get line from doc between two offsets. In case of the last line of the
            doc, method positionAt() cannot be used, so we get a string between the
            lat line offset and doc length. */
            if (index === docOffsets.length - 1) {
                docLine = doc.getText({
                    start: doc.positionAt(docOffsets[index]),
                    end: doc.positionAt(doc.getText().length),
                });
                if (docLine.length === 0 && pathStack.length !== 1) {
                    break;
                }
            }
            else {
                docLine = doc.getText({
                    start: doc.positionAt(docOffsets[index]),
                    end: doc.positionAt(docOffsets[index + 1]),
                });
            }
            newContent = newContent.concat(intendation, docLine);
            const newLineRelation = {
                newLine: this._newToOld.length,
                originLine: index,
                originUri: atom_languageclient_1.Convert.pathToUri(docPath),
                originPath: docPath,
                indentationLength: intendation.length,
            };
            if (this._oldToNew.has(index)) {
                this._oldToNew.get(index).push(newLineRelation);
            }
            else {
                this._oldToNew.set(index, [newLineRelation]);
            }
            this._newToOld.push(newLineRelation);
            /* Checking if the line contains #include statement, in case it does
            recursively call buildDoc(). */
            const includeMatch = docLine.match(this.INCLUDE_REGEX);
            if (includeMatch) {
                const subDocPath = path.join(path.dirname(docPath), includeMatch[3]);
                /* If there is an Error parsing the subdocument, throw an ReferenceError.
                If the error is already an ReferenceError pass the error by throwing it. */
                try {
                    this._includes.set(this._newToOld.length - 1, subDocPath);
                    newContent = this.buildDocument(newContent, subDocPath, intendation.concat(includeMatch[1] ? this.getCommentIndentation(docLine) : ''), editorDocs, pathStack);
                }
                catch (err) {
                    this._includeErrors.push(new include_error_1.IncludeError(subDocPath, vscode_languageserver_protocol_1.Range.create(vscode_languageserver_protocol_1.Position.create(index, docLine.length - 1 - includeMatch[2].length), vscode_languageserver_protocol_1.Position.create(index, docLine.length - 1)), atom_languageclient_1.Convert.pathToUri(docPath), err.message ? 1 : 0));
                }
            }
        }
        pathStack.pop();
        return newContent;
    }
    /**
     * Gets the indentation in front of `#` character and returns it.
     *
     * @param line - line containing `#include` comment with indentation.
     */
    getCommentIndentation(line) {
        let result = '';
        let index = 0;
        while (line[index] !== '#') {
            result = result.concat(line[index]);
            index++;
        }
        return result;
    }
    /**
     * Checks whether `params` is instance of CompletionParams, since 'instanceOf'
     * cannot be used on interfaces.
     *
     * @param params - object which has to checked.
     */
    instanceOfCompletionParams(params) {
        return 'context' in params;
    }
}
exports.ComposedDocument = ComposedDocument;
//# sourceMappingURL=composed-document.js.map