export default class IdeGladiatorConfView {
  private _element: HTMLDivElement;

  constructor(serializedState: any) {
    // Create root element
    this._element = document.createElement('div');
    this._element.classList.add('ide-gladiator-conf');

    // Create message element
    const message = document.createElement('div');
    message.textContent = "The IdeGladiatorConf package is Alive! It's ALIVE!";
    message.classList.add('message');
    this._element.appendChild(message);
  }

  // Returns an object that can be retrieved when package is activated
  public serialize() {}

  // Tear down any state and detach
  public destroy() {
    this._element.remove();
  }

  public getElement() {
    return this._element;
  }
}
