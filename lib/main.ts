import { CompositeDisposable, Pane } from 'atom';
import { createPane } from './ui-pane';

class Extension {
  private _pane: Pane | null = null;
  private readonly _subscriptions = new CompositeDisposable();

  public initialize(state: ReturnType<Extension['serialize']>) {
    return;
  }

  public activate(state: ReturnType<Extension['serialize']>) {
    if (!atom.workspace.paneForURI('atom://ide-gladiator-conf/arena-pane')) {
      createPane();
    }
    this._subscriptions.add(
      atom.commands.add('atom-workspace', {
        'ide-gladiator-conf:toggle': () => this.toggle(),
      }),

      atom.commands.add('atom-workspace', {
        'ide-gladiator-conf:show-ui': () => {
          if (
            !atom.workspace.paneForURI('atom://ide-gladiator-conf/arena-pane')
          ) {
            createPane();
          }
        },
      }),
    );
  }

  public serialize() {
    return;
  }

  public deactivate() {
    if (this._subscriptions !== null) {
      this._subscriptions.dispose();
    }
    return;
  }

  private toggle() {
    // TODO: tento kod by mal byt urcite niekde inde :)
    // if (pane !== null) {
    //   return pane.isVisible() ? pane.hide() : pane.show();
    // }
    console.log('hell yeah');
    if (!atom.workspace.paneForURI('atom://ide-gladiator-conf/arena-pane')) {
      createPane();
    }
  }
}

export default new Extension();

// export { pane, Pane };
//  | null: null,
//   subscriptions: new CompositeDisposable(),

//   activate(state: any) {
//     // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
//     console.log('hello');
//     if (!atom.workspace.paneForURI('atom://ide-gladiator-conf/arena-pane')) {
//       createPane();
//     }

//     // Register command that toggles this view
//     this.subscriptions.add(
//       atom.commands.add('atom-workspace', {
//         'ide-gladiator-conf:toggle': () => this.toggle(),
//       }),

//       atom.commands.add('atom-workspace', {
//         'ide-gladiator-conf:show-ui': () => {
//           if (
//             atom.workspace.paneForURI(
//               'atom://ide-gladiator-conf/arena-pane',
//             ) === undefined
//           ) {
//             createPane();
//           }
//         },
//       }),
//     );
//   },

//   deactivate() {
//     // pane.destroy();
//     // if (subscribe !== null) {
//     //   subscribe.dispose();
//     // }
//     // if (confView !== null) {
//     //   confView.destroy();
//     // }
//     if (this.subscriptions !== null) {
//       this.subscriptions.dispose();
//     }
//   },

//   serialize(): any {
//     // if (confView !== null) {
//     //   return {
//     //     ideGladiatorConfViewState: confView.serialize(),
//     //   };
//     // }
//   },

//   toggle() {
//     // if (pane !== null) {
//     //   return pane.isVisible() ? pane.hide() : pane.show();
//     // }
//     console.log('hell yeah');
//     if (
//       atom.workspace.paneForURI('atom://ide-gladiator-conf/arena-pane') ===
//       undefined
//     ) {
//       createPane();
//     }
//   },
// };

// const client = new GladiatorConfClient();

// module.exports = client;
