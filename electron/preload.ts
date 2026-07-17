import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../src/types/desktop';

const desktopApi: DesktopApi = {
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  saveFile: request => ipcRenderer.invoke('file:save', request),
};

contextBridge.exposeInMainWorld('desktop', desktopApi);
