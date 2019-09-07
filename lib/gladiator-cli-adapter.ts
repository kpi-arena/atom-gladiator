import { BufferedProcess, ProcessOptions } from 'atom';
import * as path from 'path';
import { ConsoleProvider } from './main';
import CommandPaletteView from './ui';
import { getProjectOrHomePath } from './util';

export const CONFIG_FILE_REGEX = /([\\/])\.gladiator\.(yml)$/;
export const CONFIG_FILE_NAME = '.gladiator.yml';
export const PROBLEMSET_URL = '/api/v2/utils/schema/problemset-definition';
export const VARIANTS_URL = '/api/v2/utils/schema/problemset-variants';

export class GladiatorCliAdapter {
  private cliPresent: boolean | undefined;

  private schemaUriCache: string | null = null;
  private formatCache: string | null = null;

  constructor(private readonly getConsole: ConsoleProvider) {}

  public async getSchemaUri(): Promise<string> {
    if (this.schemaUriCache === null) {
      await this.checkCliPresence();
      const rawUri = await this.execute(['files', 'schema', '-u'], { silent: true });
      this.schemaUriCache = rawUri.replace(/\r?\n|\r/, '');
    }
    return this.schemaUriCache;
  }

  public async generateFilesToDir(view: CommandPaletteView) {
    await this.checkCliPresence();
    const input = await view.getInput(
      'Enter the project directory',
      getProjectOrHomePath(),
      'Enter the path of the directory in which the files will be generated.'
    );
    if (input === null) {
      return;
    }

    this.execute(['files', 'generate', '-d', input], {}).then(() => {
      atom.open({
        pathsToOpen: [path.join(input, CONFIG_FILE_NAME)],
      });
    });
  }

  public async getConfigFilePath(silent: boolean): Promise<string> {
    await this.checkCliPresence();
    const scriptPath = getScriptPath();

    if (!scriptPath) {
      if (!silent) {
        noScriptPathWarning();
      }
      return Promise.reject();
    }

    return this.execute(['files', 'config-path'], {
      scriptPath,
      silent: true,
    });
  }

  public async packProblemset(view: CommandPaletteView, scriptPath?: string) {
    await this.checkCliPresence();
    if (!scriptPath) {
      scriptPath = getScriptPath();
    }

    if (!scriptPath) {
      noScriptPathWarning();
      return;
    }

    const input = await view.getInput(
      'Name of the package',
      '',
      'Enter the the name of the package without the .zip suffix.'
    );

    if (input === null) {
      return;
    }

    const packageName = input.length > 0 ? `${input}.zip` : 'package.zip';
    this.execute(['problemset', 'pack', packageName], {
      scriptPath,
    });
  }

  public async pushProblemset(view: CommandPaletteView, scriptPath?: string) {
    await this.checkCliPresence();
    if (!scriptPath) {
      scriptPath = getScriptPath();
    }

    if (!scriptPath) {
      noScriptPathWarning();
      return;
    }

    const args = ['problemset', 'push'];

    // const pid = await view.getInput(
    //   'Problemset PID',
    //   '',
    //   'Specify PID to be used for the problemset.'
    // );
    //
    // if (pid) {
    //   args.push('-p', pid);
    // }
    //
    // const newPassword = await view.getInput(
    //   'New password',
    //   '',
    //   'Changes the current master password.'
    // );
    //
    // if (newPassword) {
    //   args.push('--new-password', newPassword);
    // }

    this.execute(args, { scriptPath });
  }

  public async packDockerImage(scriptPath?: string) {
    await this.checkCliPresence();
    if (!scriptPath) {
      scriptPath = getScriptPath();
    }

    if (!scriptPath) {
      noScriptPathWarning();
      return;
    }

    this.execute(['docker-image', 'pack'], { scriptPath });
  }

  public async buildDockerImage(scriptPath?: string) {
    await this.checkCliPresence();
    if (!scriptPath) {
      scriptPath = getScriptPath();
    }

    if (!scriptPath) {
      noScriptPathWarning();
      return;
    }

    this.execute(['docker-image', 'build'], { scriptPath });
  }

  public async getGladiatorFormat(): Promise<string> {
    if (this.formatCache === null) {
      await this.checkCliPresence();
      this.formatCache = await this.execute(['files', 'gladiator-format'], { silent: true });
    }
    return this.formatCache;
  }

  private async execute(
    args: string[],
    opt: IProcessOptions,
  ): Promise<string> {
    const atomConsole = this.getConsole();

    if (!opt.silent && atomConsole !== null) {
      atomConsole.clear();
      atomConsole.stickBottom();
      atomConsole.notice('$ gladiator ' + args.join(' '));
    }

    const options: ProcessOptions = {
      command: 'gladiator',
      autoStart: false,
      args,
    };

    if (opt.scriptPath) {
      options.options = { cwd: opt.scriptPath };
    }

    return new Promise<string>((resolve, reject) => {
      let message: string = '';

      options.stdout = (data: string): void => {
        message = message.concat(data, '\n');

        if (!opt.silent && atomConsole !== null) {
          atomConsole.raw(data, 'info', '\n');
        }
      };

      options.stderr = (data: string): void => {
        message = message.concat(data, '\n');

        if (!opt.silent && atomConsole !== null) {
          atomConsole.raw(data, 'error', '\n');
        }
      };

      options.exit = (code: number): void => {
        if (code === 0) {
          resolve(message.trim());
        } else {
          reject(message.trim());
        }
      };

      const process = new BufferedProcess(options);

      const handleError = (err: Error) => {
        if (!opt.silent && atomConsole !== null) {
          atomConsole.raw(err.message, 'error', '\n');
        }
        reject(err.message);
      };

      process.onWillThrowError(err => {
        err.handle();
        handleError(err.error);
      });

      try {
        process.start();
      } catch (e) {
        handleError(e);
      }
    });
  }

  private async checkCliPresence(): Promise<boolean> {
    if (this.cliPresent === undefined) {
      if (await this.isInstalled()) {
        this.cliPresent = true;
      } else {
        this.cliPresent = false;
        atom.notifications.addError('gladiator-cli is not available', {
          description: 'Please [install Gladiator CLI](http://arena.pages.kpi.fei.tuke.sk/gladiator/gladiator-cli/installation.html).',
          dismissable: true
        });
      }
    }

    return this.cliPresent;
  }

  private async isInstalled(): Promise<boolean> {
    try {
      await this.execute([], { silent: true });
      return true;
    } catch {
      return false;
    }
  }
}


function noScriptPathWarning(): void {
  atom.notifications.addError(`Can't determine where to look for file`, {
    description: `Please open a file (or make an editor active).`,
  });
}

interface IProcessOptions {
  scriptPath?: string;
  silent?: boolean;
}

function getScriptPath(): string | undefined {
  const editor = atom.workspace.getActiveTextEditor();

  if (editor && editor.getPath()) {
    return path.dirname(editor.getPath() as string);
  }

  return undefined;
}
