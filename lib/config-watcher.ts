import { Disposable } from 'atom';
import { exists } from 'fs';
import { join } from 'path';
import { CONFIG_FILE_NAME } from './gladiator-cli-adapter';
import { GladiatorConfClient } from './main';

export interface IConfigValues {
  apiUrl?: string;
  problemsetPath?: string;
  problemsetSchema?: string;
  variantsPath?: string;
  variantSchema?: string;
}

export class ConfigWatcher {
  private _exists: boolean = false;
  private _configPath: string;
  private _watcher: Disposable | null = null;
  private _configValues: IConfigValues = {};

  constructor(private _rootDir: string, private _client: GladiatorConfClient) {
    this._configPath = join(this._rootDir, CONFIG_FILE_NAME);

    exists(this._configPath, fileExists => {
      this._exists = fileExists;
    });

    // this._watcher = atom.project.onDidChangeFiles(events => {
    //   for (const event of events) {
    //     if (this._configPath === event.path) {
    //       switch (event.action) {
    //         case 'created':
    //         case 'modified':
    //         case 'renamed':
    //           this._exists = true;
    //           readFile(this._configPath, 'utf8', (err, data) => {
    //             if (err) {
    //               this._client.deleteTempSchemas();
    //             } else {
    //               this.parseConfig(data.toString());
    //               this._client.deleteTempSchemas();
    //               if (this._configValues.problemsetPath) {
    //                 this._client.addSchema(
    //                   this._configValues.problemsetSchema as string,
    //                   this._configValues.problemsetPath,
    //                 );
    //               }

    //               if (this._configValues.variantsPath) {
    //                 this._client.addSchema(
    //                   this._configValues.variantSchema as string,
    //                   this._configValues.variantsPath,
    //                 );
    //               }
    //             }
    //           });

    //           break;

    //         case 'deleted':
    //           this._client.deleteTempSchemas();
    //           this._exists = false;
    //       }
    //     }
    //   }
    // });
  }

  private parseConfig(content: string): boolean {
    let sendSchema = false;

    const apiUrl = this.getMatch(
      content,
      /^(\cI|\t|\x20)*api-url:(\cI|\t|\x20)*((:|\.|\\|\/|\w|-)+)(\cI|\t|\x20)*/m,
      3,
    );

    if (!apiUrl) {
      this._configValues = {};

      return true;
    } else {
      this._configValues.apiUrl = apiUrl;
    }
    // } else if (
    //   (this._configValues.apiUrl && this._configValues.apiUrl !== apiUrl) ||
    //   !this._configValues.apiUrl
    // ) {
    //   this._configValues.apiUrl = apiUrl;

    //   sendSchema = true;
    // }

    const problemsetPath = this.getMatch(
      content,
      /^(\cI|\t|\x20)*problemset-definition:(\cI|\t|\x20)*((\.|\\|\/|\w|-)+(\.yaml|\.yml))(\cI|\t|\x20)*/m,
      3,
    );

    console.log(problemsetPath);

    if (!problemsetPath) {
      this._configValues.problemsetPath = undefined;

      sendSchema = true;
    } else {
      this._configValues.problemsetPath = problemsetPath;
      this._configValues.problemsetSchema = `${
        this._configValues.apiUrl
      }/gladiator/api/v2/utils/schema/problemset-definition`;
    }
    // } else if (
    //   (this._configValues.problemsetPath &&
    //     this._configValues.problemsetPath !== problemsetPath) ||
    //   !this._configValues.problemsetPath
    // ) {
    //   this._configValues.problemsetPath = problemsetPath;
    //   this._configValues.problemsetSchema = `${
    //     this._configValues.apiUrl
    //   }/gladiator/api/v2/utils/schema/problemset-definition`;

    //   sendSchema = true;
    // }

    const variantsPath = this.getMatch(
      content,
      /^(\cI|\t|\x20)*problemset-variants:(\cI|\t|\x20)*((\.|\\|\/|\w|-)+(\.yaml|\.yml))(\cI|\t|\x20)*/m,
      3,
    );

    if (!variantsPath) {
      this._configValues.variantsPath = undefined;

      sendSchema = true;
    } else {
      this._configValues.variantsPath = variantsPath;
      this._configValues.variantSchema = `${
        this._configValues.apiUrl
      }/gladiator/api/v2/utils/schema/problemset-variants`;
    }
    // } else if (
    //   (this._configValues.variantsPath &&
    //     this._configValues.variantsPath !== variantsPath) ||
    //   !this._configValues.variantsPath
    // ) {
    //   this._configValues.variantsPath = variantsPath;
    //   this._configValues.variantSchema = `${
    //     this._configValues.apiUrl
    //   }/gladiator/api/v2/utils/schema/problemset-variants`;

    //   sendSchema = true;
    // }

    return sendSchema;
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
}
