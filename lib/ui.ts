import { Panel, TextBuffer, TextEditor } from 'atom';
import { GladiatorConfClient } from './main';

// tslint:disable-next-line: no-var-requires
const etch = require('etch');
const $ = etch.dom;

export class ArenaPane {
  /* These variables need to be defined, because they are used later, but tsc
  would throw error. */
  public element: any;
  public refs: any;

  private PANE_URI = 'atom://ide-gladiator-conf/arena-pane';

  constructor(client: GladiatorConfClient) {
    // perform custom initialization here...
    // then call `etch.initialize`:
    etch.initialize(this);

    this.refs.loadSchemaButton.addEventListener('click', () => {
      client.sendSchema(this.refs.findEditor.getText(), '/*');
    });
  }

  public show() {
    const foundPane = atom.workspace.paneForURI(this.PANE_URI);

    if (!foundPane) {
      atom.workspace.open({
        element: this.element,
        getTitle: () => 'YAML schema',
        getURI: () => this.PANE_URI,
        getDefaultLocation: () => 'bottom',
        getAllowedLocations: () => ['bottom'],
      });
    } else {
      foundPane.activate();
    }
  }

  public hide() {
    const foundPane = atom.workspace.paneForURI(this.PANE_URI);

    if (foundPane) {
      foundPane.destroy();
    }

    // TODO: show to the bottom dock after pane is destroyed.
  }

  public toggle() {
    const foundPane = atom.workspace.paneForURI(this.PANE_URI);

    if (foundPane && !foundPane.isActive()) {
      foundPane.activate();
    } else if (foundPane) {
      foundPane.destroy();
    } else {
      this.show();
    }
  }

  public async destroy() {
    // call etch.destroy to remove the element and destroy child components
    await etch.destroy(this);
    // then perform custom teardown logic here...
  }

  /* Required: The `render` method returns a virtual DOM tree representing the
  current state of the component. Etch will call `render` to build and update
  the component's associated DOM element. Babel is instructed to call the
  `etch.dom` helper in compiled JSX expressions by the `@jsx` pragma above. */
  public render() {
    return $.div(
      { tabIndex: -1, className: 'ide-gladiator-conf' },
      $.section(
        { className: 'schema-input-wrapper' },
        $.div(
          {
            className: 'editor-container',
          },
          $(TextEditor, {
            ref: 'findEditor',
            mini: true,
            placeholderText: 'Specify URL of the Arena server',
            buffer: new TextBuffer(),
          }),
        ),

        $.div(
          { className: 'load-schema-btn-wrapper' },
          $.button(
            { ref: 'loadSchemaButton', className: 'btn load-schema-btn' },
            'Load',
          ),
        ),

        $.h2('TODO: finish UI'),
      ),
    );
  }

  public update() {
    // perform custom update logic here...
    // then call `etch.update`, which is async and returns a promise
    return etch.update(this);
  }

  public isActive(): boolean {
    const foundPane = atom.workspace.paneForURI(this.PANE_URI);

    if (!foundPane) {
      return false;
    }

    return foundPane.isActive();
  }
}

export default class CommandPalleteView {
  private miniEditor: TextEditor;
  private paneItem = null;
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
    this.element.classList.add('man');
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

    this.callback(this.content);
    this.miniEditor.setText('');
    this.content = '';
  }

  public confirm() {
    this.content = this.miniEditor.getText();
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
