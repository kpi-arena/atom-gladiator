"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const atom_1 = require("atom");
class CommandPalleteView {
    constructor() {
        this.paneItem = null;
        this.previouslyFocusedElement = null;
        this.content = '';
        this.callback = (text) => { };
        this.miniEditor = new atom_1.TextEditor({ mini: true });
        this.getMiniEditorElement().addEventListener('blur', this.close.bind(this));
        this.message = document.createElement('div');
        this.message.classList.add('message');
        this.element = document.createElement('div');
        this.element.appendChild(this.getMiniEditorElement());
        this.element.appendChild(this.message);
        this.panel = atom.workspace.addModalPanel({
            item: this,
            visible: false,
        });
        atom.commands.add(this.getMiniEditorElement(), 'core:confirm', () => {
            this.confirm();
        });
        atom.commands.add(this.getMiniEditorElement(), 'core:cancel', () => {
            this.close();
        });
    }
    close() {
        if (!this.panel.isVisible()) {
            return;
        }
        this.panel.hide();
        // @ts-ignore
        if (this.getMiniEditorElement().hasFocus()) {
            this.restoreFocus();
        }
        this.callback(this.content);
        this.miniEditor.setText('');
        this.content = '';
    }
    confirm() {
        this.content = this.miniEditor.getText();
        this.close();
    }
    storeFocusedElement() {
        this.previouslyFocusedElement = document.activeElement;
        return this.previouslyFocusedElement;
    }
    restoreFocus() {
        if (this.previouslyFocusedElement &&
            this.previouslyFocusedElement.parentElement) {
            // @ts-ignore
            return this.previouslyFocusedElement.focus();
        }
        atom.views.getView(atom.workspace).focus();
    }
    getInput(placeholderText, showText, description, callback) {
        if (this.panel.isVisible()) {
            return;
        }
        this.callback = callback;
        this.content = '';
        this.miniEditor.setText(showText);
        this.miniEditor.setPlaceholderText(placeholderText);
        this.storeFocusedElement();
        this.panel.show();
        this.message.textContent = description;
        // @ts-ignore
        this.getMiniEditorElement().focus();
    }
    // Returns an object that can be retrieved when package is activated
    serialize() { }
    // Tear down any state and detach
    destroy() {
        // @ts-ignore
        this.miniEditor.remove();
    }
    setCurrentWord(text) {
        this.miniEditor.setText(text);
        this.miniEditor.selectAll();
    }
    getMiniEditorElement() {
        // @ts-ignore
        return this.miniEditor.element;
    }
}
exports.default = CommandPalleteView;
class GladiatorStatusView {
    constructor(_statusBar) {
        this._statusBar = _statusBar;
        this._element = document.createElement('encoding-selector-status');
        this._tooltipLink = document.createElement('span');
        this._tooltip = new atom_1.Disposable();
        this._element.classList.add('inline-block');
        this._tooltipLink.classList.add('icon', 'icon-gist');
        this._element.appendChild(this._tooltipLink);
        this._element.addEventListener('click', () => {
            if (this._configPath) {
                atom.workspace.open(this._configPath);
            }
        });
        this.attach();
    }
    update(configFound, configPath) {
        if (!configFound) {
            this._element.style.display = 'none';
        }
        else {
            this._element.style.display = '';
            if (this._tooltip) {
                this._tooltip.dispose();
            }
            // this._tooltipLink.textContent = 'A';
            this._configPath = configPath;
            this._tooltip = atom.tooltips.add(this._tooltipLink, {
                title: `${configPath ? configPath : ''}`,
            });
        }
    }
    attach() {
        this._statusBar.addRightTile({ priority: 200, item: this._element });
    }
}
exports.GladiatorStatusView = GladiatorStatusView;
