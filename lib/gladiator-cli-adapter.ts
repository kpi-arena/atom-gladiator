import { BufferedProcess, SpawnProcessOptions } from 'atom';

export const CONFIG_FILE_REGEX = /\/?.gladiator.(yml|yaml)$/;
export const CONFIG_FILE_NAME = '.gladiator.yml';

export function isInstalled(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const command = 'gladiator';
    const args = ['schema', '-u'];
    const stdout = (data: string): void => resolve(true);
    const stderr = (data: string): void => reject(false);

    const process = new BufferedProcess({ command, args, stdout, stderr });
  });
}

export function getSchemaUri(): Promise<string> {
  return new Promise((resolve, reject) => {
    const command = 'gladiator';
    const args = ['schema', '-u'];
    const stdout = (data: string): void => resolve(data);
    const stderr = (data: string): void => reject(data);

    const process = new BufferedProcess({ command, args, stdout, stderr });
  });
}

// cliGetSchema()
//       .then(value => console.log(`Win: ${value}`))
//       .catch(value => console.log(`Lose: ${value}`));

export function generateFilesToDir(generatePath: string) {
  return new Promise<string>((resolve, reject) => {
    const command = 'gladiator';
    const args = ['generate', '-d', generatePath];
    const stdout = (data: string): void => {
      resolve(data);
    };
    const stderr = (data: string): void => {
      reject(data);
    };

    const process = new BufferedProcess({
      command,
      args,
      stdout,
      stderr,
    });
  });
}

export function test(scriptPath: string) {
  return new Promise<string>((resolve, reject) => {
    const command = 'gladiator';
    const options: SpawnProcessOptions = {
      cwd: scriptPath,
    };
    const args = ['problemset', 'definition'];
    const stdout = (data: string): void => {
      resolve(data);
    };
    const stderr = (data: string): void => {
      reject(data);
    };

    const process = new BufferedProcess({
      command,
      args,
      options,
      stdout,
      stderr,
    });
  });
}
