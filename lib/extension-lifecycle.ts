import { CompositeDisposable } from 'atom';
import { cliText } from './gladiator-cli-adapter';
import CommandPalleteView, { ArenaPane } from './ui';

const subscriptions = new CompositeDisposable();

export function activate(pane: ArenaPane) {
  const insertView = new CommandPalleteView('', cliText);
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
      'gladiator:generate': () => insertView.open(),
    }),
  );
}

export function deactivate() {
  if (subscriptions !== null) {
    subscriptions.dispose();
  }
}
