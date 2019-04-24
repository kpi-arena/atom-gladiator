import { basename, dirname, join } from 'path';
import { SuperDocument } from './document-manager';
import * as cli from './gladiator-cli-adapter';
import { CONFIG_FILE_NAME } from './gladiator-cli-adapter';
import { GladiatorConfClient } from './main';

export class GladiatorConfig {
  private _problemsetPath: string | null = null;
  private _variantsPath: string | null = null;
  private _apiUrl: string | null = null;

  constructor(
    private _path: string | null,
    private _client: GladiatorConfClient,
  ) {
    this.parseConfig();
  }

  public get path(): string | null {
    return this._path;
  }

  public setPath(path: string): void {
    if (basename(path) !== CONFIG_FILE_NAME) {
      this._path = null;
      atom.notifications.addSuccess(
        `Invalid Gladiator configuration file: ${path}`,
      );
    } else {
      if (this.path !== path) {
        atom.notifications.addSuccess(
          `Gladiator configuration file at: ${dirname(path)}`,
        );
        this._path = path;
      }
    }

    this.parseConfig();
  }

  public generateProject(projectPath: string) {
    cli
      .generateFilesToDir(projectPath)
      .then(message => {
        if (atom.project.getPaths().indexOf(projectPath) < 0) {
          atom.open({
            pathsToOpen: [projectPath, join(projectPath, cli.CONFIG_FILE_NAME)],
            newWindow: true,
          });
        } else {
          atom.open({
            pathsToOpen: [join(projectPath, cli.CONFIG_FILE_NAME)],
          });
          this.setPath(join(projectPath, cli.CONFIG_FILE_NAME));
        }
        atom.notifications.addSuccess(`${message}`);
      })
      .catch(message => {
        atom.notifications.addError(`${message}`);
      });
  }

  private parseConfig(): void {
    if (!this._path) {
      this._client.deleteScehma(
        `${this._apiUrl}/gladiator/api/v2/utils/schema/problemset-definition`,
      );
      this._client.deleteScehma(
        `${this._apiUrl}/gladiator/api/v2/utils/schema/problemset-variants`,
      );
      return;
    }
    const doc = SuperDocument.getBasicTextDocument(this._path);

    if (!doc) {
      return;
    }

    this._apiUrl = this.getMatch(
      doc.getText(),
      /^(\cI|\t|\x20)*api-url:(\cI|\t|\x20)*((:|\.|\\|\/|\w|-)+)(\cI|\t|\x20)*/m,
      3,
    );

    if (!this._apiUrl) {
      return;
    }

    const newProbPath = this.getMatch(
      doc.getText(),
      /^(\cI|\t|\x20)*problemset-definition:(\cI|\t|\x20)*((\.|\\|\/|\w|-)+(\.yaml|\.yml))(\cI|\t|\x20)*/m,
      3,
    );

    if (newProbPath && newProbPath !== this._problemsetPath) {
      this._problemsetPath = newProbPath;

      this._client.addSchema(
        `${this._apiUrl}/gladiator/api/v2/utils/schema/problemset-definition`,
        this.getName(this._problemsetPath),
      );
    }

    const newVarPath = this.getMatch(
      doc.getText(),
      /^(\cI|\t|\x20)*problemset-variants:(\cI|\t|\x20)*((\.|\\|\/|\w|-)+(\.yaml|\.yml))(\cI|\t|\x20)*/m,
      3,
    );

    if (newVarPath && newVarPath !== this._variantsPath) {
      this._variantsPath = newVarPath;

      this._client.addSchema(
        `${this._apiUrl}/gladiator/api/v2/utils/schema/problemset-variants`,
        this.getName(this._variantsPath),
      );
    }
  }

  private getMatch(
    content: string,
    matcher: RegExp,
    desiredGroup: number,
  ): string | null {
    const match = content.match(matcher);

    if (!match || !match[desiredGroup]) {
      return null;
    }

    return match[desiredGroup];
  }

  private getName(text: string): string {
    return text.replace(/^.*[\\\/]/, '');
  }
}
