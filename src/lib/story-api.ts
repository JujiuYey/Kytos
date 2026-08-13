import type { StoryApi } from '@/types';
import { cloneJsonData } from '@/utils/serialization';

// Vue 响应式 Proxy 不能进入 Electron IPC；故事模块的对象请求统一在这里转成普通数据。
export const storyApi: StoryApi = {
  createStory: request => window.desktop.story.createStory(cloneJsonData(request)),
  createStoryShot: request => window.desktop.story.createStoryShot(cloneJsonData(request)),
  deleteStory: request => window.desktop.story.deleteStory(cloneJsonData(request)),
  deleteStoryShot: request => window.desktop.story.deleteStoryShot(cloneJsonData(request)),
  deleteStoryShotVersion: request =>
    window.desktop.story.deleteStoryShotVersion(cloneJsonData(request)),
  generateStoryShot: request => window.desktop.story.generateStoryShot(cloneJsonData(request)),
  getStoryShotTask: taskId => window.desktop.story.getStoryShotTask(taskId),
  getStoryWorkspace: () => window.desktop.story.getStoryWorkspace(),
  moveStoryShot: request => window.desktop.story.moveStoryShot(cloneJsonData(request)),
  saveStoryConversation: request =>
    window.desktop.story.saveStoryConversation(cloneJsonData(request)),
  selectStoryShotVersion: request =>
    window.desktop.story.selectStoryShotVersion(cloneJsonData(request)),
  updateStory: request => window.desktop.story.updateStory(cloneJsonData(request)),
  updateStoryShot: request => window.desktop.story.updateStoryShot(cloneJsonData(request)),
};
