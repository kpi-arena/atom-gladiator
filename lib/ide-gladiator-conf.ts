import { CompositeDisposable } from 'atom';
import IdeGladiatorConfView from './ide-gladiator-conf-view';

let confView: IdeGladiatorConfView | null = null;
let pane: any | null = null;
let subscribe: CompositeDisposable | null = null;

export default {
  confView,
  pane,
  subscribe,

  activate(state: any) {
    confView = new IdeGladiatorConfView(state.ideGladiatorConfViewState);
    pane = atom.workspace.addModalPanel({
      item: confView.getElement(),
      visible: false,
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    subscribe = new CompositeDisposable();

    // Register command that toggles this view
    subscribe.add(
      atom.commands.add('atom-workspace', {
        'ide-gladiator-conf:toggle': () => this.toggle(),
      }),
    );
  },

  deactivate() {
    pane.destroy();
    if (subscribe !== null) {
      subscribe.dispose();
    }

    if (confView !== null) {
      confView.destroy();
    }
  },

  serialize(): any {
    if (confView !== null) {
      return {
        ideGladiatorConfViewState: confView.serialize(),
      };
    }
  },

  toggle() {
    if (pane !== null) {
      return pane.isVisible() ? pane.hide() : pane.show();
    }
  },
};
