import { CompositeDisposable } from 'atom';
import { ArenaPane } from './ui';

const subscriptions = new CompositeDisposable();

export function activate(pane: ArenaPane) {
  subscriptions.add(
    atom.commands.add('atom-workspace', {
      'yaml-schema-interface:toggle': () => pane.toggle(),
    }),

    atom.commands.add('atom-workspace', {
      'yaml-schema-interface:hide': () => pane.hide(),
    }),

    atom.commands.add('atom-workspace', {
      'yaml-schema-interface:show': () => pane.show(),
    }),
  );
}

export function serialize() {
  return {};
}

export function deactivate() {
  if (subscriptions !== null) {
    subscriptions.dispose();
  }
}
