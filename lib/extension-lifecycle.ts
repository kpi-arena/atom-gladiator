import { CompositeDisposable } from 'atom';
import { cliGenerateFiles, cliGetSchema } from './gladiator-cli-adapter';
import CommandPalleteView, { ArenaPane } from './ui';
import { getProjectPath } from './util';

const subscriptions = new CompositeDisposable();
const insertView = new CommandPalleteView(generateProject);

export function activate(pane: ArenaPane) {
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
      atom.notifications.addSuccess(`${message}`);
    })
    .catch(message => {
      atom.notifications.addError(`${message}`);
    });
}
