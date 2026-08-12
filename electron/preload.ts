// 通过 contextBridge 按域把 IPC 调用桥接到渲染端 window.desktop
import { contextBridge, ipcRenderer } from 'electron';
import type {
  CharacterExpressionApi,
  CharacterLibraryApi,
  CharacterVisualAssetApi,
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

// 角色视觉资产 IPC 桥接
const assetsApi: CharacterVisualAssetApi = {
  // 删除角色视觉资产
  deleteCharacterVisualAsset: request => ipcRenderer.invoke('character-visual:delete', request),
  // 生成角色动作
  generateCharacterAction: request =>
    ipcRenderer.invoke('character-visual:generate-action', request),
  // 生成角色动作提示词
  generateCharacterActionPrompt: request =>
    ipcRenderer.invoke('character-visual:generate-action-prompt', request),
  // 生成角色参考板
  generateCharacterReferenceBoard: request =>
    ipcRenderer.invoke('character-visual:generate-reference-board', request),
  // 查询角色视觉任务
  getCharacterVisualAssetTask: taskId => ipcRenderer.invoke('character-visual:get-task', taskId),
  // 查询角色视觉工作区
  getCharacterVisualWorkspace: request =>
    ipcRenderer.invoke('character-visual:get-workspace', request),
  // 重命名角色视觉素材
  renameCharacterVisualAsset: request => ipcRenderer.invoke('character-visual:rename', request),
  // 设为官方角色视觉素材
  setCharacterVisualAssetOfficial: request =>
    ipcRenderer.invoke('character-visual:set-official', request),
  // 上传角色视觉素材
  uploadCharacterVisualAsset: request => ipcRenderer.invoke('character-visual:upload', request),
  // 保存创建角色时上传的已有视觉素材
  saveCharacterVisualAsset: request =>
    ipcRenderer.invoke('character-visual:save-official', request),
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
  // 保存应用模型与界面设置
  setAppSettings: settings => ipcRenderer.invoke('settings:set-app', settings),
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
  // 导出文件到用户选择的位置
  exportFile: request => ipcRenderer.invoke('file:export', request),
  // 按资源分类批量导出工作区图片
  exportWorkspaceImages: () => ipcRenderer.invoke('file:export-workspace-images'),
  // 保存文件
  saveFile: request => ipcRenderer.invoke('file:save', request),
};

// 桌面端 API 命名空间聚合
const desktop: DesktopApi = {
  story: storyApi,
  illustration: illustrationApi,
  character: {
    library: libraryApi,
    assets: assetsApi,
    expression: expressionApi,
  },
  settings: settingsApi,
  file: fileApi,
};

// 暴露到渲染端 window.desktop
contextBridge.exposeInMainWorld('desktop', desktop);
