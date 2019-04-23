import { BufferedProcess } from 'atom';

export function cliGetSchema(): Promise<string> {
  return new Promise((resolve, reject) => {
    const command = 'python';
    const args = [
      'D:\\Develop\\gladiator-cli\\gladiator_cli\\cli.py',
      'schema',
      '-u',
    ];
    const stdout = (data: string): void => resolve(data);
    const stderr = (data: string): void => reject(data);

    const process = new BufferedProcess({ command, args, stdout, stderr });
  });
}

// cliGetSchema()
//       .then(value => console.log(`Win: ${value}`))
//       .catch(value => console.log(`Lose: ${value}`));

export function cliGenerateFiles() {
  return new Promise((resolve, reject) => {
    const generatePath = atom.project.getPaths()[0];

    const command = 'python';
    const args = [
      'D:\\Develop\\gladiator-cli\\gladiator_cli\\cli.py',
      'generate',
      '-d',
      generatePath,
    ];
    const stdout = (data: string): void => resolve(data);
    const stderr = (data: string): void => reject(data);

    const process = new BufferedProcess({ command, args, stdout, stderr });
  });
}

export function cliText(text: string) {
  console.log(`\nCli says: ${text}\n`);
}
