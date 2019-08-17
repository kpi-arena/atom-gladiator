import { BufferedProcess, ProcessOptions } from 'atom';
import * as path from 'path';
import CommandPaletteView from './ui';
import { getProjectOrHomePath } from './util';

export const CONFIG_FILE_REGEX = /(\\|\/)\.gladiator\.(yml)$/;
export const CONFIG_FILE_NAME = '.gladiator.yml';
export const PROBLEMSET_URL = '/api/v2/utils/schema/problemset-definition';
export const VARIANTS_URL = '/api/v2/utils/schema/problemset-variants';

let cliPresenceChecked = false;
let cliPresent = false;

async function checkCliPresence(): Promise<boolean> {
  if (cliPresenceChecked) {
    return cliPresent;
  }
  cliPresenceChecked = true;
  if (await isInstalled()) {
    cliPresent = true;
  } else {
    atom.notifications.addError('gladiator-cli is not available', {
      description: 'Please [install Gladiator CLI](http://arena.pages.kpi.fei.tuke.sk/gladiator/gladiator-cli/installation.html).',
      dismissable: true
    });
  }
  return cliPresent;
}

export async function isInstalled(): Promise<boolean> {
  try {
    await execute([], { silent: true });
    return true;
  } catch {
    return false;
  }
}

export async function getSchemaUri(): Promise<string> {
  await checkCliPresence();
  const rawUri = await execute(['files', 'schema', '-u'], { silent: true });
  return rawUri.replace(/\r?\n|\r/, '');
}

export async function generateFilesToDir(view: CommandPaletteView) {
  await checkCliPresence();
  view.getInput(
    'Enter the project directory',
    getProjectOrHomePath(),
    'Enter the path of the directory in which the files will be generated.',
    (input: string) => {
      execute(['files', 'generate', '-d', input], {}).then(() => {
        atom.open({
          pathsToOpen: [path.join(input, CONFIG_FILE_NAME)],
        });
      });
    },
  );
}

export async function getConfigFilePath(silent: boolean): Promise<string> {
  await checkCliPresence();
  const scriptPath = getScriptPath();

  if (!scriptPath) {
    if (!silent) {
      noScriptPathWarning();
    }
    return Promise.reject();
  }

  return execute(['files', 'config-path'], {
    scriptPath,
    silent: true,
  });
}

export async function packProblemset(view: CommandPaletteView, scriptPath?: string) {
  await checkCliPresence();
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
      const packageName = input.length > 0 ? `${input}.zip` : 'package.zip';
      execute(['problemset', 'pack', packageName], {
        scriptPath,
      });
    },
  );
}

export async function pushProblemset(view: CommandPaletteView, scriptPath?: string) {
  await checkCliPresence();
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
          execute(args, { scriptPath });
        },
      );
    },
  );
}

export async function packDockerImage(scriptPath?: string) {
  await checkCliPresence();
  if (!scriptPath) {
    scriptPath = getScriptPath();
  }

  if (!scriptPath) {
    noScriptPathWarning();
    return;
  }

  execute(['docker-image', 'pack'], { scriptPath });
}

export async function buildDockerImage(scriptPath?: string) {
  await checkCliPresence();
  if (!scriptPath) {
    scriptPath = getScriptPath();
  }

  if (!scriptPath) {
    noScriptPathWarning();
    return;
  }

  execute(['docker-image', 'build', '-L'], { scriptPath });
}

export async function getGladiatorFormat() {
  await checkCliPresence();
  return execute(['files', 'gladiator-format'], { silent: true });
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

function execute(
  args: string[],
  opt: IProcessOptions,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const options: ProcessOptions = {
      command: 'gladiator',
      autoStart: false,
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

    const handleError = (err: Error) => {
      if (!opt.silent) {
        atom.notifications.addError('gladiator-cli error', {
          description: err.message,
          stack: err.stack,
        });
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

function getScriptPath(): string | undefined {
  const editor = atom.workspace.getActiveTextEditor();

  if (editor && editor.getPath()) {
    return path.dirname(editor.getPath() as string);
  }

  return undefined;
}
