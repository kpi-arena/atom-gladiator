import { IServerSettings } from './server-settings';

export interface IClientState {
  isPaneActive: boolean;
  serverSettings: IServerSettings;
}
