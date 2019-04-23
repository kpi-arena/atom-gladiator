export function getProjectPath(): string {
  const paths = atom.project.getPaths();

  if (paths.length < 1) {
    const homeDir =
      process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'];

    return homeDir ? homeDir : '';
  }

  return paths[0];
}
