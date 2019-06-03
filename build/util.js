"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const atom_languageclient_1 = require("atom-languageclient");
const fs_1 = require("fs");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
exports.LANGUAGE_ID = 'yaml';
function getProjectOrHomePath() {
    const paths = atom.project.getPaths();
    if (paths.length < 1) {
        const homeDir = process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'];
        return homeDir ? homeDir : '';
    }
    return paths[0];
}
exports.getProjectOrHomePath = getProjectOrHomePath;
function getOpenYAMLDocuments() {
    const result = new Map();
    atom.workspace.getTextEditors().forEach(editor => {
        const editorPath = editor.getBuffer().getPath();
        /* Skipping file if it's not a YAML file saved on drive. */
        if (!editorPath || !editorPath.match(/(\.yaml|\.yml)$/i)) {
            return;
        }
        /* Pushing a TextDocument created from open YAML docoment. */
        result.set(editorPath, vscode_languageserver_protocol_1.TextDocument.create(editor.getBuffer().getUri(), exports.LANGUAGE_ID, 0, editor.getBuffer().getText()));
    });
    return result;
}
exports.getOpenYAMLDocuments = getOpenYAMLDocuments;
function getBasicTextDocument(docPath, editorDocs) {
    if (!editorDocs) {
        editorDocs = getOpenYAMLDocuments();
    }
    let doc = editorDocs.get(docPath);
    /* Checking if the document is open in the editor. In case it's not, get
    the doc from the drive. */
    if (!doc) {
        doc = getDocumentFromDrive(docPath);
    }
    return doc;
}
exports.getBasicTextDocument = getBasicTextDocument;
/**
 * Creating a TextDocument from a YAML file located on the drive. If error
 * occurs while reading file, the error is caught and undefined is returned.
 */
function getDocumentFromDrive(docPath) {
    try {
        return vscode_languageserver_protocol_1.TextDocument.create(atom_languageclient_1.Convert.pathToUri(docPath), exports.LANGUAGE_ID, 0, fs_1.readFileSync(docPath).toString());
    }
    catch (err) {
        return undefined;
    }
}
exports.getDocumentFromDrive = getDocumentFromDrive;
