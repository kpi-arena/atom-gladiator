import { CompositeDisposable } from 'atom';
import { Disposable } from 'vscode-jsonrpc';
import * as cli from './gladiator-cli-adapter';
import { GladiatorConfig } from './gladiator-config';
import { GladiatorConfClient } from './main';
import CommandPalleteView, { ArenaPane } from './ui';
import { getConfPath, getProjectOrHomePath } from './util';

const subscriptions = new CompositeDisposable();
const insertView = new CommandPalleteView();
let watcher: Disposable | null = null;

export function activate(pane: ArenaPane, clientParam: GladiatorConfClient) {
  // client = clientParam;
  const config = new GladiatorConfig(getConfPath(), clientParam);

  if (!cli.isInstalled()) {
    atom.notifications.addFatalError('gladiator-cli is not installed');
    return false;
  } else {
    cli
      .getSchemaUri()
      .then(value =>
        clientParam.addSchema(
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
          config.generateProject,
        ),
    }),

    // atom.commands.add('atom-workspace', {
    //   'gladiator:set-config-path': () =>
    //     insertView.open(
    //       'Enter the config file path',
    //       getProjectOrHomePath(),
    //       'Enter the path to the `.gladiator.yml` config file.',
    //       config.setPath,
    //     ),
    // }),

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
        if (event.path === config.path) {
          config.setPath(event.path);
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
