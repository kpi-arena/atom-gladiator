import { dirname } from 'path';
import { SuperDocument } from './document-manager';
import * as cli from './gladiator-cli-adapter';
import { getConfPath } from './util';

export class GladiatorConfig {
  private _problemsetPath: string | null = null;
  private _variantsPath: string | null = null;
  private _apiUrl: string | null = null;
  private _schemas: Map<string, string> = new Map();
  private _path: string | null;

  constructor() {
    this._path = getConfPath();

    this.parseConfig();
  }

  public get path(): string | null {
    return this._path;
  }

  public setPath(path: string): void {
    if (this.getName(path) !== cli.CONFIG_FILE_NAME) {
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
    console.log(this._path);
    this.parseConfig();
  }

  public getSchemas(): Map<string, string> {
    return this._schemas;
  }

  private parseConfig(): void {
    if (!this._path) {
      this._schemas.delete(
        `${this._apiUrl}/gladiator/api/v2/utils/schema/problemset-definition`,
      );
      this._schemas.delete(
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

      this._schemas.set(
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

      this._schemas.set(
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
