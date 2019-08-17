import { Disposable, Panel, TextEditor } from 'atom';

export default class CommandPaletteView {
  private miniEditor: TextEditor;
  // private paneItem = null;
  private panel: Panel;
  private previouslyFocusedElement: Element | null = null;
  private element: HTMLElement;
  private message: HTMLElement;
  private content: string = '';

  constructor() {
    this.miniEditor = new TextEditor({ mini: true });
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

  public close() {
    if (!this.panel.isVisible()) {
      return;
    }

    this.panel.hide();
    // @ts-ignore
    if (this.getMiniEditorElement().hasFocus()) {
      this.restoreFocus();
    }

    this.miniEditor.setText('');
    this.content = '';
  }

  public confirm() {
    this.content = this.miniEditor.getText();
    this.callback(this.content);
    this.close();
  }

  public storeFocusedElement() {
    this.previouslyFocusedElement = document.activeElement;
    return this.previouslyFocusedElement;
  }

  public restoreFocus() {
    if (
      this.previouslyFocusedElement &&
      this.previouslyFocusedElement.parentElement
    ) {
      // @ts-ignore
      return this.previouslyFocusedElement.focus();
    }
    atom.views.getView(atom.workspace).focus();
  }

  public getInput(
    placeholderText: string,
    showText: string,
    description: string,
    callback: (text: string) => void,
  ) {
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
  public serialize() {}

  // Tear down any state and detach
  public destroy() {
    // @ts-ignore
    this.miniEditor.remove();
  }

  public setCurrentWord(text: string) {
    this.miniEditor.setText(text);
    this.miniEditor.selectAll();
  }

  private getMiniEditorElement(): Element {
    // @ts-ignore
    return this.miniEditor.element;
  }

  private callback: (text: string) => void = (text: string) => {};
}

export class GladiatorStatusView {
  private _element = document.createElement('encoding-selector-status');
  private _tooltipLink = document.createElement('span');
  private _tooltip: Disposable = new Disposable();
  private _configPath: string | undefined;

  constructor(private _statusBar: any) {
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

  public update(configPath?: string) {
    if (!configPath) {
      this._element.style.display = 'none';
    } else {
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

  private attach() {
    this._statusBar.addRightTile({ priority: 200, item: this._element });
  }
}
