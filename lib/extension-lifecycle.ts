import { CompositeDisposable } from 'atom';
import * as fs from 'fs';
import * as path from 'path';
import { Disposable } from 'vscode-jsonrpc';
import * as cli from './gladiator-cli-adapter';
import { GladiatorConfClient } from './main';
import CommandPalleteView, { ArenaPane } from './ui';
import { getProjectOrHomePath } from './util';

const subscriptions = new CompositeDisposable();
const insertView = new CommandPalleteView();
let client: GladiatorConfClient;
let configPath: string | null = null;
let watcher: Disposable | null = null;

export function activate(pane: ArenaPane, clientParam: GladiatorConfClient) {
  client = clientParam;

  if (!cli.isInstalled()) {
    atom.notifications.addFatalError('gladiator-cli is not installed');
    return false;
  } else {
    cli
      .getSchemaUri()
      .then(value =>
        client.addSchema(
          value.replace(/\r?\n|\r/, ''),
          `/${cli.CONFIG_FILE_NAME}`,
        ),
      );
  }

  subscriptions.add(
    atom.commands.add('atom-workspace', {
      'gladiator:toggle': () => pane.toggle(),
    }),

    atom.commands.add('atom-workspace', {
      'gladiator:hide': () => pane.hide(),
    }),

    atom.commands.add('atom-workspace', {
      'gladiator:show': () => pane.show(),
    }),

    atom.commands.add('atom-workspace', {
      'gladiator:generate': () =>
        insertView.open(
          'Enter the project directory',
          getProjectOrHomePath(),
          'Enter the path of the directory in which the files will be generated.',
          generateProject,
        ),
    }),

    atom.commands.add('atom-workspace', {
      'gladiator:set-config-path': () =>
        insertView.open(
          'Enter the config file path',
          getProjectOrHomePath(),
          'Enter the path to the `.gladiator.yml` config file.',
          setConfigFile,
        ),
    }),

    atom.commands.add('atom-workspace', {
      'gladiator:test': () =>
        cli
          .test(atom.project.getPaths()[0])
          .then(value => console.log(value))
          .catch(value => console.log(value)),
      // getGladiatorConfPath().forEach(value => console.log(value)),
    }),

    (watcher = atom.project.onDidChangeFiles(events => {
      for (const event of events) {
        if (event.path.match(cli.CONFIG_FILE_NAME)) {
          client.validateConfigFile(event);
        }
      }
    })),
  );

  return true;
}

export function deactivate() {
  if (subscriptions !== null) {
    subscriptions.dispose();
  }

  if (watcher !== null) {
    watcher.dispose();
  }
}

function generateProject(projectPath: string) {
  cli
    .generateFilesToDir(projectPath)
    .then(message => {
      if (atom.project.getPaths().indexOf(projectPath) < 0) {
        atom.open({
          pathsToOpen: [
            projectPath,
            path.join(projectPath, cli.CONFIG_FILE_NAME),
          ],
          newWindow: true,
        });
      }
      // atom.project.setPaths([projectPath]);
      // atom.workspace.open(path.join(projectPath, cli.CONFIG_FILE_NAME));
      // cli
      //   .getSchemaUri()
      //   .then(value =>
      //     client.addSchema(
      //       value.replace(/\r?\n|\r/, ''),
      //       `/${cli.CONFIG_FILE_NAME}`,
      //     ),
      //   );
      // atom.notifications.addSuccess(`${message}`);
    })
    .catch(message => {
      atom.notifications.addError(`${message}`);
    });
}

function setConfigFile(userInput: string): void {
  if (!userInput.match(cli.CONFIG_FILE_REGEX) || !fs.existsSync(userInput)) {
    atom.notifications.addError('Not valid config file.');
  } else {
    client.setConfigFile(userInput);
  }
}
