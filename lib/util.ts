import { Convert } from 'atom-languageclient';
import { readFileSync } from 'fs';
import { TextDocument } from 'vscode-languageserver-protocol';

export const LANGUAGE_ID = 'yaml';

export function getProjectOrHomePath(): string {
  const paths = atom.project.getPaths();

  if (paths.length < 1) {
    const homeDir =
      process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'];

    return homeDir ? homeDir : '';
  }

  return paths[0];
}

export function getOpenYAMLDocuments(): Map<string, TextDocument> {
  const result: Map<string, TextDocument> = new Map();

  atom.workspace.getTextEditors().forEach(editor => {
    const editorPath = editor.getBuffer().getPath();

    /* Skipping file if it's not a YAML file saved on drive. */
    if (!editorPath || !editorPath.match(/(\.yaml|\.yml)$/i)) {
      return;
    }

    /* Pushing a TextDocument created from open YAML docoment. */
    result.set(
      editorPath,
      TextDocument.create(
        editor.getBuffer().getUri(),
        LANGUAGE_ID,
        0,
        editor.getBuffer().getText(),
      ),
    );
  });

  return result;
}

export function getBasicTextDocument(
  docPath: string,
  editorDocs?: Map<string, TextDocument>,
): TextDocument | undefined {
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

/**
 * Creating a TextDocument from a YAML file located on the drive. If error
 * occurs while reading file, the error is caught and undefined is returned.
 */
export function getDocumentFromDrive(
  docPath: string,
): TextDocument | undefined {
  try {
    return TextDocument.create(
      Convert.pathToUri(docPath),
      LANGUAGE_ID,
      0,
      readFileSync(docPath).toString(),
    );
  } catch (err) {
    return undefined;
  }
}
