import { TextBuffer, TextEditor } from 'atom';
import server from './main';

const etch = require('etch');
const $ = etch.dom;

export class UIpanel {
  public createPanel() {
    const bottomDock = atom.workspace.getBottomDock();

    /* const view = atom.views.addViewProvider((model: object) => {
      console.log(model);

      const result = document.createElement('h1') as HTMLElement;
      result.innerHTML = 'HELLO ROLAND';

      return result;
    }); */

    const inside = document.createElement('div');
    inside.setAttribute('id', 'randomdiv');

    /* Creating input field for JSON schema URL. */
    const schemaInput = document.createElement('input');
    schemaInput.setAttribute('type', 'text');
    schemaInput.setAttribute('id', 'schemaAddress');
    /* Ensured normal working of keyboard. */
    schemaInput.setAttribute('class', 'native-key-bindings');
    schemaInput.setAttribute('size', '50');

    const schemaButton = document.createElement('button');
    schemaButton.innerHTML = 'SUBMIT';
    schemaButton.addEventListener('click', () => {
      server.sendSettings();
    });

    inside.appendChild(schemaInput);
    inside.appendChild(schemaButton);

    atom.workspace.open({
      element: inside,
      getTitle: () => 'Gladiator conf',
      getURI: () => 'atom://ide-gladiator-conf/my-item',
      getDefaultLocation: () => 'bottom',
      getAllowedLocations: () => ['bottom', 'right'],
    });
  }
}

class MyComponent {
  // Required: Define an ordinary constructor to initialize your component.
  constructor(props: any, children: any) {
    // perform custom initialization here...
    // then call `etch.initialize`:
    etch.initialize(this);
  }

  // Optional: Destroy the component. Async/await syntax is pretty but optional.
  public async destroy() {
    // call etch.destroy to remove the element and destroy child components
    await etch.destroy(this);
    // then perform custom teardown logic here...
  }

  // Required: The `render` method returns a virtual DOM tree representing the
  // current state of the component. Etch will call `render` to build and update
  // the component's associated DOM element. Babel is instructed to call the
  // `etch.dom` helper in compiled JSX expressions by the `@jsx` pragma above.
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
            placeholderText: 'Find in current buffer',
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
            $.button({ ref: 'nextButton', className: 'btn btn-next' }, 'Find'),
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

  // Required: Update the component with new properties and children.
  public update(props: any, children: any) {
    // perform custom update logic here...
    // then call `etch.update`, which is async and returns a promise
    return etch.update(this);
  }
}
