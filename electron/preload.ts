import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../shared/desktop';

const desktopApi: DesktopApi = {
  createCharacter: request => ipcRenderer.invoke('character-library:create-character', request),
  createStory: request => ipcRenderer.invoke('story:create', request),
  createStoryShot: request => ipcRenderer.invoke('story:create-shot', request),
  createIllustrationTopic: request => ipcRenderer.invoke('illustration:create-topic', request),
  deleteIllustrationTopic: request => ipcRenderer.invoke('illustration:delete-topic', request),
  deleteIllustrationVersion: request => ipcRenderer.invoke('illustration:delete-version', request),
  deleteIllustrationUpload: request => ipcRenderer.invoke('illustration:delete-upload', request),
  deleteCharacterExpression: request => ipcRenderer.invoke('character-expression:delete', request),
  deleteCharacter: request => ipcRenderer.invoke('character-library:delete-character', request),
  deleteCharacterPortrait: request => ipcRenderer.invoke('character-portrait:delete', request),
  deleteCharacterSheet: request => ipcRenderer.invoke('character-sheet:delete', request),
  deleteCredential: service => ipcRenderer.invoke('credential:delete', service),
  deleteStory: request => ipcRenderer.invoke('story:delete', request),
  deleteStoryShot: request => ipcRenderer.invoke('story:delete-shot', request),
  deleteStoryShotVersion: request => ipcRenderer.invoke('story:delete-shot-version', request),
  generateCharacterExpression: request =>
    ipcRenderer.invoke('character-expression:generate', request),
  generateCharacterExpressionPrompt: request =>
    ipcRenderer.invoke('character-expression:generate-prompt', request),
  generateCharacterPortrait: request => ipcRenderer.invoke('character-portrait:generate', request),
  generateCharacterSheet: request => ipcRenderer.invoke('character-sheet:generate', request),
  generateIllustration: request => ipcRenderer.invoke('illustration:generate', request),
  generateStoryShot: request => ipcRenderer.invoke('story:generate-shot', request),
  getCharacterExpressionTask: request =>
    ipcRenderer.invoke('character-expression:get-task', request),
  getCharacterExpressionWorkspace: request =>
    ipcRenderer.invoke('character-expression:get-workspace', request),
  getCharacterLibrary: () => ipcRenderer.invoke('character-library:get'),
  getCharacterPortraitTask: taskId => ipcRenderer.invoke('character-portrait:get-task', taskId),
  getCharacterPortraitWorkspace: request =>
    ipcRenderer.invoke('character-portrait:get-workspace', request),
  getCharacterSheetTask: taskId => ipcRenderer.invoke('character-sheet:get-task', taskId),
  getCharacterWorkspace: () => ipcRenderer.invoke('character:get-workspace'),
  getIllustrationTask: taskId => ipcRenderer.invoke('illustration:get-task', taskId),
  getIllustrationWorkspace: () => ipcRenderer.invoke('illustration:get-workspace'),
  getStoryShotTask: taskId => ipcRenderer.invoke('story:get-shot-task', taskId),
  getStoryWorkspace: () => ipcRenderer.invoke('story:get-workspace'),
  getCredentialStatus: service => ipcRenderer.invoke('credential:get-status', service),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  openWorkspaceDirectory: () => ipcRenderer.invoke('workspace:open'),
  moveStoryShot: request => ipcRenderer.invoke('story:move-shot', request),
  renameCharacterExpression: request => ipcRenderer.invoke('character-expression:rename', request),
  renameCharacterVisualAsset: request => ipcRenderer.invoke('character-visual:rename', request),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  saveFile: request => ipcRenderer.invoke('file:save', request),
  saveCharacterProfile: request => ipcRenderer.invoke('character:save-profile', request),
  saveIllustrationConversation: request =>
    ipcRenderer.invoke('illustration:save-conversation', request),
  saveStoryConversation: request => ipcRenderer.invoke('story:save-conversation', request),
  selectCharacterPortrait: request => ipcRenderer.invoke('character-portrait:select', request),
  selectCharacter: request => ipcRenderer.invoke('character-library:select-character', request),
  selectCharacterSheet: request => ipcRenderer.invoke('character-sheet:select', request),
  selectIllustrationStyleReference: request =>
    ipcRenderer.invoke('illustration:select-style-reference', request),
  selectStoryShotVersion: request => ipcRenderer.invoke('story:select-shot-version', request),
  setCredential: request => ipcRenderer.invoke('credential:set', request),
  setCharacterVisualAssetOfficial: request =>
    ipcRenderer.invoke('character-visual:set-official', request),
  setWorkspaceDirectory: workspacePath =>
    ipcRenderer.invoke('workspace:set-directory', workspacePath),
  useSuggestedWorkspace: () => ipcRenderer.invoke('workspace:use-suggested'),
  uploadCharacterExpression: request => ipcRenderer.invoke('character-expression:upload', request),
  uploadCharacterPortrait: request => ipcRenderer.invoke('character-portrait:upload', request),
  uploadCharacterVisualAsset: request => ipcRenderer.invoke('character-visual:upload', request),
  uploadCharacterSheet: request => ipcRenderer.invoke('character-sheet:upload', request),
  uploadIllustration: request => ipcRenderer.invoke('illustration:upload', request),
  updateIllustrationTopic: request => ipcRenderer.invoke('illustration:update-topic', request),
  updateCharacter: request => ipcRenderer.invoke('character-library:update-character', request),
  updateStory: request => ipcRenderer.invoke('story:update', request),
  updateStoryShot: request => ipcRenderer.invoke('story:update-shot', request),
};

contextBridge.exposeInMainWorld('desktop', desktopApi);
