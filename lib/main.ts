import { CompositeDisposable, Pane } from 'atom';
import { createPane } from './ui-pane';

class Extension {
  private readonly _subscriptions = new CompositeDisposable();

  // public initialize(state: ReturnType<Extension['serialize']>) {
  //   return;
  // }

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
    console.log('hell yeah');
    if (!atom.workspace.paneForURI('atom://ide-gladiator-conf/arena-pane')) {
      createPane();
    }
  }
}

module.exports = new Extension();

// const client = new GladiatorConfClient();

// module.exports = client;
