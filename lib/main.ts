import { CompositeDisposable, Pane } from 'atom';
import { ArenaPane } from './ui';

class Extension {
  private readonly _pane = new ArenaPane();
  private readonly _subscriptions = new CompositeDisposable();

  // public initialize(state: ReturnType<Extension['serialize']>) {
  //   return;
  // }

  public activate(state: ReturnType<Extension['serialize']>) {
    this._subscriptions.add(
      atom.commands.add('atom-workspace', {
        'yaml-schema-interface:toggle': () => this._pane.toggle()
      }),

      atom.commands.add('atom-workspace', {
        'yaml-schema-interface:hide': () => this._pane.hide()
      }),

      atom.commands.add('atom-workspace', {
        'yaml-schema-interface:show': () => this._pane.show()
      })
    );
  }

  public serialize() {
    return {};
  }

  public deactivate() {
    if (this._subscriptions !== null) {
      this._subscriptions.dispose();
    }
    return;
  }
}

module.exports = new Extension();

// const client = new GladiatorConfClient();

// module.exports = client;
