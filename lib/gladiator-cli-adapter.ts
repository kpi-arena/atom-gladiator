import { BufferedProcess } from 'atom';

export function cliGetSchema(): Promise<string> {
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

export function cliGenerateFiles(generatePath: string) {
  return new Promise<string>((resolve, reject) => {
    const command = 'gladiator';
    const args = ['generate', '-d', generatePath];
    const stdout = (data: string): void => {
      console.log(data);
      resolve(data);
    };
    const stderr = (data: string): void => {
      console.log(data);
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
