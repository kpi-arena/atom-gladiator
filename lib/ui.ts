import { TextBuffer, TextEditor } from 'atom';

const etch = require('etch');
const $ = etch.dom;

export class ArenaPane {
  /* These variables need to be defined, because they are used later, but tsc
  would throw error. */
  public element: any;
  public refs: any;

  private PANE_URI = 'atom://ide-gladiator-conf/arena-pane';

  constructor() {
    // perform custom initialization here...
    // then call `etch.initialize`:
    etch.initialize(this);

    this.refs.submitURLButton.addEventListener('click', () => {
      this.loadSchema();
    });
  }

  public show() {
    const foundPane = atom.workspace.paneForURI(this.PANE_URI);

    if (
      !foundPane
    ) {
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
      { tabIndex: -1, className: 'find-and-replace' },
      $.section(
        { className: 'input-block find-container' },
        $.div(
          {
            className:
              'input-block-item input-block-item--flex editor-container',
          },
          $(TextEditor, {
            ref: 'findEditor',
            mini: true,
            placeholderText: 'Specify URL of the Arena server',
            buffer: new TextBuffer(),
          }),

          $.div(
            { className: 'find-meta-container' },
            $.span({
              ref: 'resultCounter',
              className: 'text-subtle result-counter',
            }),
          ),
        ),

        $.div(
          { className: 'input-block-item' },
          $.div(
            { className: 'btn-group btn-group-find' },
            $.button(
              { ref: 'submitURLButton', className: 'btn btn-next' },
              'Submit',
            ),
          ),

          $.div(
            { className: 'btn-group btn-group-find-all' },
            $.button(
              { ref: 'findAllButton', className: 'btn btn-all' },
              'Find All',
            ),
          ),
        ),
      ),
    );
  }

  public update() {
    // perform custom update logic here...
    // then call `etch.update`, which is async and returns a promise
    return etch.update(this);
  }

  public loadSchema() {
    const schemaURL: string = this.refs.findEditor.getText();

    if (schemaURL.length === 0) {
      return;
    }
  }
}
