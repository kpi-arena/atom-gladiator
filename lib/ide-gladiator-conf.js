'use babel';

import IdeGladiatorConfView from './ide-gladiator-conf-view';
import { CompositeDisposable } from 'atom';

export default {

  ideGladiatorConfView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.ideGladiatorConfView = new IdeGladiatorConfView(state.ideGladiatorConfViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.ideGladiatorConfView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'ide-gladiator-conf:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.ideGladiatorConfView.destroy();
  },

  serialize() {
    return {
      ideGladiatorConfViewState: this.ideGladiatorConfView.serialize()
    };
  },

  toggle() {
    console.log('IdeGladiatorConf was toggled!');
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  }
};
