import { CompositeDisposable } from 'atom';
import * as path from 'path';
import { cliGenerateFiles, cliGetSchema } from './gladiator-cli-adapter';
import { GladiatorConfClient } from './main';
import CommandPalleteView, { ArenaPane } from './ui';
import { getProjectPath } from './util';

const subscriptions = new CompositeDisposable();
const insertView = new CommandPalleteView(generateProject);
let client: GladiatorConfClient;

export function activate(pane: ArenaPane, clientParam: GladiatorConfClient) {
  client = clientParam;
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
      'gladiator:generate': () => insertView.open(getProjectPath()),
    }),

    atom.commands.add('atom-workspace', {
      'gladiator:schema': () =>
        cliGetSchema().then(value => console.log(value)),
    }),
  );
}

export function deactivate() {
  if (subscriptions !== null) {
    subscriptions.dispose();
  }
}

function generateProject(projectPath: string) {
  cliGenerateFiles(projectPath)
    .then(message => {
      atom.project.setPaths([projectPath]);
      atom.workspace.open(path.join(projectPath, './.gladiator.yml'));
      cliGetSchema().then(value =>
        client.addSchema(value.replace(/\r?\n|\r/, ''), '/.gladiator.yml'),
      );
      atom.notifications.addSuccess(`${message}`);
    })
    .catch(message => {
      atom.notifications.addError(`${message}`);
    });
}

function gladiatorConfigExists(): boolean {}
