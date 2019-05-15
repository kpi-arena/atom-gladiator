import { BufferedProcess, ProcessOptions } from 'atom';
import * as path from 'path';
import CommandPalleteView from './ui';
import { getProjectOrHomePath } from './util';

export const CONFIG_FILE_REGEX = /(\\|\/)\.gladiator\.(yml)$/;
export const CONFIG_FILE_NAME = '.gladiator.yml';
export const PROBLEMSET_URL =
  '/gladiator/api/v2/utils/schema/problemset-definition';
export const VARIANTS_URL =
  '/gladiator/api/v2/utils/schema/problemset-variants';

export function isInstalled(): Promise<boolean> {
  return getProcessPromise([], { silent: true })
    .then(() => {
      return true;
    })
    .catch(() => {
      return false;
    });
}

export function getSchemaUri(): Promise<string> {
  // return getProcessPromise(['schema', '-u'], { silent: true }).then(value => {
  //   let newVal = value.replace(/['"]+/g, '');
  //   newVal = newVal.replace(/\r?\n|\r/, '');
  //   console.log(JSON.stringify(newVal));
  //   return newVal;
  // });
  return new Promise<string>((resolve, reject) => {
    const command = 'gladiator';
    const args = ['files', 'schema', '-u'];
    const stdout = (data: string): void => resolve(data);
    const stderr = (data: string): void => reject(data);
    const process = new BufferedProcess({ command, args, stdout, stderr });
  }).then(value => value.replace(/\r?\n|\r/, ''));
}

export function generateFilesToDir(view: CommandPalleteView): void {
  view.getInput(
    'Enter the project directory',
    getProjectOrHomePath(),
    'Enter the path of the directory in which the files will be generated.',
    (input: string) => {
      getProcessPromise(['files', 'generate', '-d', input], {}).then(() => {
        atom.open({
          pathsToOpen: [path.join(input, CONFIG_FILE_NAME)],
        });
      });
    },
  );
}

export function getConfigFilePath(silent: boolean): Promise<string> {
  const scriptPath = getScriptPath();

  if (!scriptPath) {
    return new Promise<string>((resolve, reject) => {
      if (!silent) {
        noScriptPathWarning();
      }

      reject();
    });
  }

  return getProcessPromise(['files', 'config-path'], {
    scriptPath,
    silent: true,
  });
}

export function problemsetPack(view: CommandPalleteView, scriptPath?: string) {
  if (!scriptPath) {
    scriptPath = getScriptPath();
  }

  if (!scriptPath) {
    noScriptPathWarning();
    return;
  }

  view.getInput(
    'Name of the package',
    '',
    'Enter the the name of the package without the .zip suffix.',
    (input: string) => {
      if (input.length > 0) {
        getProcessPromise(['problemset', 'pack', input], { scriptPath });
      }
    },
  );
}

export function problemsetPush(view: CommandPalleteView, scriptPath?: string) {
  if (!scriptPath) {
    scriptPath = getScriptPath();
  }

  if (!scriptPath) {
    noScriptPathWarning();
    return;
  }

  let pid: string = '';

  view.getInput(
    'Problemset PID',
    '',
    'Specify PID to be used for the problemset.',
    (pidInput: string) => {
      pid = pidInput;
      view.getInput(
        'New password',
        '',
        'Changes the current master password.',
        (password: string) => {
          const args = ['problemset', 'push'];

          if (pid.length > 0) {
            args.push('-p', pid);
          }

          if (password.length > 0) {
            args.push('--new-password', password);
          }
          getProcessPromise(args, { scriptPath });
        },
      );
    },
  );
}

export function dockerImagePack(scriptPath?: string) {
  if (!scriptPath) {
    scriptPath = getScriptPath();
  }

  if (!scriptPath) {
    noScriptPathWarning();
    return;
  }

  getProcessPromise(['docker-image', 'pack'], { scriptPath });
}

export function dockerImageBuild(scriptPath?: string) {
  if (!scriptPath) {
    scriptPath = getScriptPath();
  }

  if (!scriptPath) {
    noScriptPathWarning();
    return;
  }

  getProcessPromise(['docker-image', 'build'], { scriptPath });
}

export function getGladiatorFormat() {
  return getProcessPromise(['files', 'gladiator-format'], { silent: true });
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

function getProcessPromise(
  args: string[],
  opt: IProcessOptions,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const options: ProcessOptions = {
      command: 'gladiator',
      args,
    };

    if (opt.scriptPath) {
      options.options = { cwd: opt.scriptPath };
    }

    let message: string = '';

    options.stdout = (data: string): void => {
      message = message.concat(data, '\n');

      // atom.notifications.addSuccess(data);

      // resolve(data);
    };

    options.stderr = (data: string): void => {
      message = message.concat(data, '\n');
      // atom.notifications.addError(data);

      // reject(data);
    };

    options.exit = (code: number): void => {
      if (code === 0) {
        if (!opt.silent) {
          atom.notifications.addSuccess('Success', {
            detail: message,
          });
        }

        resolve(message.trim());
      } else {
        if (!opt.silent) {
          atom.notifications.addError('gladiator-cli error', {
            description: message,
          });
        }
        reject(message.trim());
      }
    };

    const process = new BufferedProcess(options);

    process.onWillThrowError(err => {
      if (!opt.silent) {
        atom.notifications.addError('gladiator-cli error', {
          description: err.error.message,
          stack: err.error.stack,
        });
      }
      reject(err.error.message);
    });
  });
}

function getScriptPath(): string | undefined {
  const editor = atom.workspace.getActiveTextEditor();

  if (editor && editor.getPath()) {
    return path.dirname(editor.getPath() as string);
  }

  return undefined;
}
