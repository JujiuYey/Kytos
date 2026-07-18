import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../shared/desktop';

const desktopApi: DesktopApi = {
  createIllustrationTopic: request => ipcRenderer.invoke('illustration:create-topic', request),
  deleteIllustrationTopic: request => ipcRenderer.invoke('illustration:delete-topic', request),
  deleteIllustrationVersion: request => ipcRenderer.invoke('illustration:delete-version', request),
  deleteIllustrationUpload: request => ipcRenderer.invoke('illustration:delete-upload', request),
  deleteCharacterExpression: request => ipcRenderer.invoke('character-expression:delete', request),
  deleteCharacterPortrait: request => ipcRenderer.invoke('character-portrait:delete', request),
  deleteCharacterSheet: request => ipcRenderer.invoke('character-sheet:delete', request),
  deleteCredential: service => ipcRenderer.invoke('credential:delete', service),
  generateCharacterExpression: request =>
    ipcRenderer.invoke('character-expression:generate', request),
  generateCharacterPortrait: request => ipcRenderer.invoke('character-portrait:generate', request),
  generateCharacterSheet: request => ipcRenderer.invoke('character-sheet:generate', request),
  generateIllustration: request => ipcRenderer.invoke('illustration:generate', request),
  getCharacterExpressionTask: taskId => ipcRenderer.invoke('character-expression:get-task', taskId),
  getCharacterExpressionWorkspace: () => ipcRenderer.invoke('character-expression:get-workspace'),
  getCharacterPortraitTask: taskId => ipcRenderer.invoke('character-portrait:get-task', taskId),
  getCharacterPortraitWorkspace: () => ipcRenderer.invoke('character-portrait:get-workspace'),
  getCharacterSheetTask: taskId => ipcRenderer.invoke('character-sheet:get-task', taskId),
  getCharacterWorkspace: () => ipcRenderer.invoke('character:get-workspace'),
  getIllustrationTask: taskId => ipcRenderer.invoke('illustration:get-task', taskId),
  getIllustrationWorkspace: () => ipcRenderer.invoke('illustration:get-workspace'),
  getCredentialStatus: service => ipcRenderer.invoke('credential:get-status', service),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  openWorkspaceDirectory: () => ipcRenderer.invoke('workspace:open'),
  renameCharacterExpression: request => ipcRenderer.invoke('character-expression:rename', request),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  saveFile: request => ipcRenderer.invoke('file:save', request),
  saveCharacterProfile: request => ipcRenderer.invoke('character:save-profile', request),
  saveIllustrationConversation: request =>
    ipcRenderer.invoke('illustration:save-conversation', request),
  selectCharacterPortrait: request => ipcRenderer.invoke('character-portrait:select', request),
  selectCharacterSheet: request => ipcRenderer.invoke('character-sheet:select', request),
  selectIllustrationStyleReference: request =>
    ipcRenderer.invoke('illustration:select-style-reference', request),
  setCredential: request => ipcRenderer.invoke('credential:set', request),
  setWorkspaceDirectory: workspacePath =>
    ipcRenderer.invoke('workspace:set-directory', workspacePath),
  useSuggestedWorkspace: () => ipcRenderer.invoke('workspace:use-suggested'),
  uploadCharacterExpression: request => ipcRenderer.invoke('character-expression:upload', request),
  uploadCharacterPortrait: request => ipcRenderer.invoke('character-portrait:upload', request),
  uploadCharacterSheet: request => ipcRenderer.invoke('character-sheet:upload', request),
  uploadIllustration: request => ipcRenderer.invoke('illustration:upload', request),
  updateIllustrationTopic: request => ipcRenderer.invoke('illustration:update-topic', request),
};

contextBridge.exposeInMainWorld('desktop', desktopApi);
