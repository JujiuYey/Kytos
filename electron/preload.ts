// 通过 contextBridge 按域把 IPC 调用桥接到渲染端 window.desktop
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

// 故事 IPC 桥接
const storyApi: StoryApi = {
  // 创建故事
  createStory: request => ipcRenderer.invoke('story:create', request),
  // 创建故事分镜
  createStoryShot: request => ipcRenderer.invoke('story:create-shot', request),
  // 删除故事
  deleteStory: request => ipcRenderer.invoke('story:delete', request),
  // 删除故事分镜
  deleteStoryShot: request => ipcRenderer.invoke('story:delete-shot', request),
  // 删除故事分镜版本
  deleteStoryShotVersion: request => ipcRenderer.invoke('story:delete-shot-version', request),
  // 生成故事分镜
  generateStoryShot: request => ipcRenderer.invoke('story:generate-shot', request),
  // 查询故事分镜任务
  getStoryShotTask: taskId => ipcRenderer.invoke('story:get-shot-task', taskId),
  // 查询故事工作区
  getStoryWorkspace: () => ipcRenderer.invoke('story:get-workspace'),
  // 移动故事分镜
  moveStoryShot: request => ipcRenderer.invoke('story:move-shot', request),
  // 保存故事会话
  saveStoryConversation: request => ipcRenderer.invoke('story:save-conversation', request),
  // 选中故事分镜版本
  selectStoryShotVersion: request => ipcRenderer.invoke('story:select-shot-version', request),
  // 更新故事
  updateStory: request => ipcRenderer.invoke('story:update', request),
  // 更新故事分镜
  updateStoryShot: request => ipcRenderer.invoke('story:update-shot', request),
};

// 插画 IPC 桥接
const illustrationApi: IllustrationApi = {
  // 创建插画主题
  createIllustrationTopic: request => ipcRenderer.invoke('illustration:create-topic', request),
  // 删除插画主题
  deleteIllustrationTopic: request => ipcRenderer.invoke('illustration:delete-topic', request),
  // 删除插画版本
  deleteIllustrationVersion: request => ipcRenderer.invoke('illustration:delete-version', request),
  // 删除已上传插画
  deleteIllustrationUpload: request => ipcRenderer.invoke('illustration:delete-upload', request),
  // 生成插画
  generateIllustration: request => ipcRenderer.invoke('illustration:generate', request),
  // 查询插画任务
  getIllustrationTask: taskId => ipcRenderer.invoke('illustration:get-task', taskId),
  // 查询插画工作区
  getIllustrationWorkspace: () => ipcRenderer.invoke('illustration:get-workspace'),
  // 保存插画会话
  saveIllustrationConversation: request =>
    ipcRenderer.invoke('illustration:save-conversation', request),
  // 更新插画主题
  updateIllustrationTopic: request => ipcRenderer.invoke('illustration:update-topic', request),
  // 上传插画
  uploadIllustration: request => ipcRenderer.invoke('illustration:upload', request),
};

// 角色库 IPC 桥接
const libraryApi: CharacterLibraryApi = {
  // 创建角色概要
  createCharacter: request => ipcRenderer.invoke('character-library:create-character', request),
  // 删除角色
  deleteCharacter: request => ipcRenderer.invoke('character-library:delete-character', request),
  // 查询角色库
  getCharacterLibrary: () => ipcRenderer.invoke('character-library:get'),
  // 选中角色
  selectCharacter: request => ipcRenderer.invoke('character-library:select-character', request),
  // 更新角色概要
  updateCharacter: request => ipcRenderer.invoke('character-library:update-character', request),
};

// 角色头像/设定图/视觉素材管理 IPC 桥接
const portraitApi: CharacterPortraitApi = {
  // 删除角色头像
  deleteCharacterPortrait: request => ipcRenderer.invoke('character-portrait:delete', request),
  // 删除角色设定图
  deleteCharacterSheet: request => ipcRenderer.invoke('character-sheet:delete', request),
  // 生成角色头像
  generateCharacterPortrait: request => ipcRenderer.invoke('character-portrait:generate', request),
  // 生成角色设定图
  generateCharacterSheet: request => ipcRenderer.invoke('character-sheet:generate', request),
  // 查询角色头像任务
  getCharacterPortraitTask: taskId => ipcRenderer.invoke('character-portrait:get-task', taskId),
  // 查询角色头像工作区
  getCharacterPortraitWorkspace: request =>
    ipcRenderer.invoke('character-portrait:get-workspace', request),
  // 查询角色设定图任务
  getCharacterSheetTask: taskId => ipcRenderer.invoke('character-sheet:get-task', taskId),
  // 查询角色工作区
  getCharacterWorkspace: () => ipcRenderer.invoke('character:get-workspace'),
  // 重命名角色视觉素材
  renameCharacterVisualAsset: request => ipcRenderer.invoke('character-visual:rename', request),
  // 选中角色头像
  selectCharacterPortrait: request => ipcRenderer.invoke('character-portrait:select', request),
  // 选中角色设定图
  selectCharacterSheet: request => ipcRenderer.invoke('character-sheet:select', request),
  // 设为官方角色视觉素材
  setCharacterVisualAssetOfficial: request =>
    ipcRenderer.invoke('character-visual:set-official', request),
  // 上传角色头像
  uploadCharacterPortrait: request => ipcRenderer.invoke('character-portrait:upload', request),
  // 上传角色设定图
  uploadCharacterSheet: request => ipcRenderer.invoke('character-sheet:upload', request),
  // 上传角色视觉素材
  uploadCharacterVisualAsset: request => ipcRenderer.invoke('character-visual:upload', request),
};

// 角色表情 IPC 桥接
const expressionApi: CharacterExpressionApi = {
  // 删除角色表情
  deleteCharacterExpression: request => ipcRenderer.invoke('character-expression:delete', request),
  // 生成角色表情
  generateCharacterExpression: request =>
    ipcRenderer.invoke('character-expression:generate', request),
  // 生成角色表情提示词
  generateCharacterExpressionPrompt: request =>
    ipcRenderer.invoke('character-expression:generate-prompt', request),
  // 查询角色表情任务
  getCharacterExpressionTask: request =>
    ipcRenderer.invoke('character-expression:get-task', request),
  // 查询角色表情工作区
  getCharacterExpressionWorkspace: request =>
    ipcRenderer.invoke('character-expression:get-workspace', request),
  // 重命名角色表情
  renameCharacterExpression: request => ipcRenderer.invoke('character-expression:rename', request),
  // 上传角色表情
  uploadCharacterExpression: request => ipcRenderer.invoke('character-expression:upload', request),
};

// 角色视觉素材生成 IPC 桥接
const visualApi: CharacterVisualApi = {
  // 生成角色视觉素材
  generateCharacterVisual: request =>
    ipcRenderer.invoke('character-library:generate-visual', request),
  // 查询角色视觉素材生成结果
  getCharacterVisualGeneration: request =>
    ipcRenderer.invoke('character-library:get-visual-generation', request),
  // 保存角色视觉素材
  saveCharacterVisual: request => ipcRenderer.invoke('character-library:save-visual', request),
  // 保存角色视觉素材资源
  saveCharacterVisualAsset: request =>
    ipcRenderer.invoke('character-library:save-visual-asset', request),
};

// 设置与凭据 IPC 桥接
const settingsApi: SettingsApi = {
  // 删除凭据
  deleteCredential: service => ipcRenderer.invoke('credential:delete', service),
  // 查询凭据状态
  getCredentialStatus: service => ipcRenderer.invoke('credential:get-status', service),
  // 查询桌面设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  // 打开工作区目录
  openWorkspaceDirectory: () => ipcRenderer.invoke('workspace:open'),
  // 选择目录
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  // 设置凭据
  setCredential: request => ipcRenderer.invoke('credential:set', request),
  // 设置主题
  setTheme: theme => ipcRenderer.invoke('settings:set-theme', theme),
  // 设置工作区目录
  setWorkspaceDirectory: workspacePath =>
    ipcRenderer.invoke('workspace:set-directory', workspacePath),
  // 使用推荐工作区
  useSuggestedWorkspace: () => ipcRenderer.invoke('workspace:use-suggested'),
};

// 文件 IPC 桥接
const fileApi: FileApi = {
  // 保存文件
  saveFile: request => ipcRenderer.invoke('file:save', request),
};

// 桌面端 API 命名空间聚合
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

// 暴露到渲染端 window.desktop
contextBridge.exposeInMainWorld('desktop', desktop);
