import { contextBridge, ipcRenderer } from 'electron';
import type {
  CharacterExpressionApi,
  CharacterLibraryApi,
  CharacterPortraitApi,
  CharacterVisualApi,
  DesktopApi,
  FileApi,
  IllustrationApi,
  SettingsApi,
  StoryApi,
} from '../shared/desktop';

const storyApi: StoryApi = {
  createStory: request => ipcRenderer.invoke('story:create', request),
  createStoryShot: request => ipcRenderer.invoke('story:create-shot', request),
  deleteStory: request => ipcRenderer.invoke('story:delete', request),
  deleteStoryShot: request => ipcRenderer.invoke('story:delete-shot', request),
  deleteStoryShotVersion: request => ipcRenderer.invoke('story:delete-shot-version', request),
  generateStoryShot: request => ipcRenderer.invoke('story:generate-shot', request),
  getStoryShotTask: taskId => ipcRenderer.invoke('story:get-shot-task', taskId),
  getStoryWorkspace: () => ipcRenderer.invoke('story:get-workspace'),
  moveStoryShot: request => ipcRenderer.invoke('story:move-shot', request),
  saveStoryConversation: request => ipcRenderer.invoke('story:save-conversation', request),
  selectStoryShotVersion: request => ipcRenderer.invoke('story:select-shot-version', request),
  updateStory: request => ipcRenderer.invoke('story:update', request),
  updateStoryShot: request => ipcRenderer.invoke('story:update-shot', request),
};

const illustrationApi: IllustrationApi = {
  createIllustrationTopic: request => ipcRenderer.invoke('illustration:create-topic', request),
  deleteIllustrationTopic: request => ipcRenderer.invoke('illustration:delete-topic', request),
  deleteIllustrationVersion: request => ipcRenderer.invoke('illustration:delete-version', request),
  deleteIllustrationUpload: request => ipcRenderer.invoke('illustration:delete-upload', request),
  generateIllustration: request => ipcRenderer.invoke('illustration:generate', request),
  getIllustrationTask: taskId => ipcRenderer.invoke('illustration:get-task', taskId),
  getIllustrationWorkspace: () => ipcRenderer.invoke('illustration:get-workspace'),
  saveIllustrationConversation: request =>
    ipcRenderer.invoke('illustration:save-conversation', request),
  updateIllustrationTopic: request => ipcRenderer.invoke('illustration:update-topic', request),
  uploadIllustration: request => ipcRenderer.invoke('illustration:upload', request),
};

const libraryApi: CharacterLibraryApi = {
  deleteCharacter: request => ipcRenderer.invoke('character-library:delete-character', request),
  getCharacterLibrary: () => ipcRenderer.invoke('character-library:get'),
  selectCharacter: request => ipcRenderer.invoke('character-library:select-character', request),
};

const portraitApi: CharacterPortraitApi = {
  deleteCharacterPortrait: request => ipcRenderer.invoke('character-portrait:delete', request),
  deleteCharacterSheet: request => ipcRenderer.invoke('character-sheet:delete', request),
  generateCharacterPortrait: request => ipcRenderer.invoke('character-portrait:generate', request),
  generateCharacterSheet: request => ipcRenderer.invoke('character-sheet:generate', request),
  getCharacterPortraitTask: taskId => ipcRenderer.invoke('character-portrait:get-task', taskId),
  getCharacterPortraitWorkspace: request =>
    ipcRenderer.invoke('character-portrait:get-workspace', request),
  getCharacterSheetTask: taskId => ipcRenderer.invoke('character-sheet:get-task', taskId),
  getCharacterWorkspace: () => ipcRenderer.invoke('character:get-workspace'),
  renameCharacterVisualAsset: request => ipcRenderer.invoke('character-visual:rename', request),
  selectCharacterPortrait: request => ipcRenderer.invoke('character-portrait:select', request),
  selectCharacterSheet: request => ipcRenderer.invoke('character-sheet:select', request),
  setCharacterVisualAssetOfficial: request =>
    ipcRenderer.invoke('character-visual:set-official', request),
  uploadCharacterPortrait: request => ipcRenderer.invoke('character-portrait:upload', request),
  uploadCharacterSheet: request => ipcRenderer.invoke('character-sheet:upload', request),
  uploadCharacterVisualAsset: request => ipcRenderer.invoke('character-visual:upload', request),
};

const expressionApi: CharacterExpressionApi = {
  deleteCharacterExpression: request => ipcRenderer.invoke('character-expression:delete', request),
  generateCharacterExpression: request =>
    ipcRenderer.invoke('character-expression:generate', request),
  generateCharacterExpressionPrompt: request =>
    ipcRenderer.invoke('character-expression:generate-prompt', request),
  getCharacterExpressionTask: request =>
    ipcRenderer.invoke('character-expression:get-task', request),
  getCharacterExpressionWorkspace: request =>
    ipcRenderer.invoke('character-expression:get-workspace', request),
  renameCharacterExpression: request => ipcRenderer.invoke('character-expression:rename', request),
  uploadCharacterExpression: request => ipcRenderer.invoke('character-expression:upload', request),
};

const visualApi: CharacterVisualApi = {
  generateCharacterVisual: request => ipcRenderer.invoke('character-library:generate-visual', request),
  getCharacterVisualGeneration: request =>
    ipcRenderer.invoke('character-library:get-visual-generation', request),
  saveCharacterVisual: request => ipcRenderer.invoke('character-library:save-visual', request),
  saveCharacterVisualAsset: request =>
    ipcRenderer.invoke('character-library:save-visual-asset', request),
};

const settingsApi: SettingsApi = {
  deleteCredential: service => ipcRenderer.invoke('credential:delete', service),
  getCredentialStatus: service => ipcRenderer.invoke('credential:get-status', service),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  openWorkspaceDirectory: () => ipcRenderer.invoke('workspace:open'),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  setCredential: request => ipcRenderer.invoke('credential:set', request),
  setTheme: theme => ipcRenderer.invoke('settings:set-theme', theme),
  setWorkspaceDirectory: workspacePath =>
    ipcRenderer.invoke('workspace:set-directory', workspacePath),
  useSuggestedWorkspace: () => ipcRenderer.invoke('workspace:use-suggested'),
};

const fileApi: FileApi = {
  saveFile: request => ipcRenderer.invoke('file:save', request),
};

const desktop: DesktopApi = {
  story: storyApi,
  illustration: illustrationApi,
  character: {
    library: libraryApi,
    portrait: portraitApi,
    expression: expressionApi,
    visual: visualApi,
  },
  settings: settingsApi,
  file: fileApi,
};

contextBridge.exposeInMainWorld('desktop', desktop);