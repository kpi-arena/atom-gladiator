import { CompositeDisposable } from 'atom';
import { createPane } from './ui-pane';

let pane: any | null = null;
// let subscriptions: CompositeDisposable;

export default {
  pane,
  subscriptions: new CompositeDisposable(),

  activate(state: any) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();
    console.log('hello');
    if (
      atom.workspace.paneForURI('atom://ide-gladiator-conf/arena-pane') ===
      undefined
    ) {
      createPane();
    }

    // Register command that toggles this view
    this.subscriptions.add(
      atom.commands.add('atom-workspace', {
        'ide-gladiator-conf:toggle': () => this.toggle(),
      }),

      atom.commands.add('atom-workspace', {
        'ide-gladiator-conf:show-ui': () => {
          if (
            atom.workspace.paneForURI(
              'atom://ide-gladiator-conf/arena-pane',
            ) === undefined
          ) {
            createPane();
          }
        },
      }),
    );
  },

  deactivate() {
    // pane.destroy();
    // if (subscribe !== null) {
    //   subscribe.dispose();
    // }
    // if (confView !== null) {
    //   confView.destroy();
    // }
    if (this.subscriptions !== null) {
      this.subscriptions.dispose();
    }
  },

  serialize(): any {
    // if (confView !== null) {
    //   return {
    //     ideGladiatorConfViewState: confView.serialize(),
    //   };
    // }
  },

  toggle() {
    // if (pane !== null) {
    //   return pane.isVisible() ? pane.hide() : pane.show();
    // }
    console.log('hell yeah');
    if (
      atom.workspace.paneForURI('atom://ide-gladiator-conf/arena-pane') ===
      undefined
    ) {
      createPane();
    }
  },
};

// const client = new GladiatorConfClient();

// module.exports = client;
