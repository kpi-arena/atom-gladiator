import { GlobSync } from 'glob';
import * as path from 'path';
import * as cli from './gladiator-cli-adapter';

export function getProjectOrHomePath(): string {
  const paths = atom.project.getPaths();

  if (paths.length < 1) {
    const homeDir =
      process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'];

    return homeDir ? homeDir : '';
  }

  return paths[0];
}

export function getGladiatorConfPath(): string[] {
  const result: string[] = [];

  atom.project.getPaths().forEach(projectPath => {
    const globResult = new GlobSync('**/.gladiator.yml', { cwd: projectPath });

    globResult.found.forEach(match => {
      result.push(path.join(projectPath, match));
    });
  });

  return result;
}

export function getConfPath(): string | null {
  let result: string | null = null;

  atom.project.getDirectories().forEach(dir => {
    if (result) {
      return;
    } else if (dir.getFile(cli.CONFIG_FILE_NAME).existsSync()) {
      result = dir.getFile(cli.CONFIG_FILE_NAME).getPath();
    }
  });

  return result;
}

export function getExpectedPath(): string | null {
  if (atom.project.getPaths().length < 1) {
    return null;
  }
  return path.join(atom.project.getPaths()[0], cli.CONFIG_FILE_NAME);
}
