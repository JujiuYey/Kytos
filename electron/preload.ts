import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../shared/desktop';

const desktopApi: DesktopApi = {
  deleteCredential: service => ipcRenderer.invoke('credential:delete', service),
  getCredentialStatus: service => ipcRenderer.invoke('credential:get-status', service),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  openWorkspaceDirectory: () => ipcRenderer.invoke('workspace:open'),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  saveFile: request => ipcRenderer.invoke('file:save', request),
  setCredential: request => ipcRenderer.invoke('credential:set', request),
  setWorkspaceDirectory: workspacePath =>
    ipcRenderer.invoke('workspace:set-directory', workspacePath),
  useSuggestedWorkspace: () => ipcRenderer.invoke('workspace:use-suggested'),
};

contextBridge.exposeInMainWorld('desktop', desktopApi);
