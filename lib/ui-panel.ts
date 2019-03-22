import { ViewRegistry, Workspace } from 'atom';

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
    
    const schemaInput = document.createElement('input');
    schemaInput.setAttribute('type', 'text');
    schemaInput.setAttribute('id', 'schemaAddress');
    schemaInput.setAttribute('class', 'native-key-bindings');

    const schemaButton = document.createElement('button');
    schemaButton.innerHTML = 'SUBMIT';
    schemaButton.addEventListener('click', () => {
        const inputField = document.getElementById('randomdiv');
        console.log(inputField);
    });

    inside.appendChild(schemaInput);
    inside.appendChild(schemaButton);

    atom.workspace.open({
      element: inside,
      getTitle: () => 'Gladiator conf',
      getURI: () => 'atom://-idegladiator-conf/my-item',
      getDefaultLocation: () => 'bottom',
      getAllowedLocations: () => ['bottom', 'right'],
    });
  }
}
