// 故事模块的类型定义与请求/响应模型
import type { UIMessage } from 'ai';
import type {
  CharacterVisualImage,
  CharacterVisualResolution,
  CharacterVisualAssetSelection,
  CharacterVisualTaskStatus,
} from './character-visual';
import type { IllustrationSize } from './illustration';
import type { IllustrationReference } from './illustration';

// 故事 Agent 端点
export const STORY_AGENT_ENDPOINT = 'app://bundle/api/story-agent';
// 故事分镜数量上下限
export const STORY_SHOT_LIMITS = { max: 6, min: 3 } as const;

// 故事草稿
export interface StoryDraft {
  // 冲突
  conflict: string;
  // 结局
  ending: string;
  // 目标
  goal: string;
  // 前提
  premise: string;
  // 场景设定
  setting: string;
  // 摘要
  summary: string;
  // 风格基调
  tone: string;
  // 转折点
  turningPoint: string;
}

// 故事分镜内容
export interface StoryShotContent {
  // 动作
  action: string;
  // 画面构图
  composition: string;
  // 前后衔接
  continuity: string;
  // 情绪
  emotion: string;
  // 最终提示词
  finalPrompt: string;
  // 旁白
  narration: string;
  // 用途
  purpose: string;
  // 场景
  scene: string;
  // 标题
  title: string;
}

// 分镜版本引用
export interface StoryVersionReference {
  // 文件名
  fileName: string;
  // 分镜ID
  shotId: string;
  // 版本ID
  versionId: string;
}

// 分镜版本
export interface StoryShotVersion {
  // 基础版本
  baseVersion: StoryVersionReference | null;
  // 角色视觉引用列表
  characterReferences: CharacterVisualAssetSelection[];
  // 生成时实际使用的完整参考快照
  references: IllustrationReference[];
  // 衔接版本
  continuityVersion: StoryVersionReference | null;
  // 创建时间
  createdAt: string;
  // 错误信息
  errorMessage: string | null;
  // 版本ID
  id: string;
  // 图片列表
  images: CharacterVisualImage[];
  // 生成进度
  progress: number;
  // 提示词
  prompt: string;
  // 分辨率
  resolution: CharacterVisualResolution;
  // 尺寸
  size: IllustrationSize;
  // 任务状态
  status: CharacterVisualTaskStatus;
  // 更新时间
  updatedAt: string;
  // 版本号
  versionNumber: number;
}

// 故事分镜
export interface StoryShot extends StoryShotContent {
  // 分镜ID
  id: string;
  // 图像是否过时
  imageStale: boolean;
  // 排序
  order: number;
  // 选中版本ID
  selectedVersionId: string | null;
  // 版本列表
  versions: StoryShotVersion[];
  // 本镜覆盖参考；为空时继承故事级参考
  references: IllustrationReference[];
}

// 故事项目
export interface StoryProject {
  // 参演角色ID
  characterIds: string[];
  // 创建时间
  createdAt: string;
  // 故事草稿
  draft: StoryDraft;
  // 项目ID
  id: string;
  // 关键分镜ID
  keyShotId: string | null;
  // 会话消息
  messages: StoryAgentMessage[];
  // 分辨率
  resolution: CharacterVisualResolution;
  // 分镜列表
  shots: StoryShot[];
  // 尺寸
  size: IllustrationSize;
  // 分镜是否就绪
  storyboardReady: boolean;
  // 分镜是否过时
  storyboardStale: boolean;
  // 故事是否就绪
  storyReady: boolean;
  // 标题
  title: string;
  // 更新时间
  updatedAt: string;
  // 故事级默认参考
  references: IllustrationReference[];
}

// 故事工作区状态
export interface StoryWorkspaceState {
  // 故事列表
  stories: StoryProject[];
}

// 故事草稿更新结果
export interface StoryDraftUpdateResult {
  // 故事草稿
  draft: StoryDraft;
  // 分镜是否过时
  storyboardStale: boolean;
  // 故事是否就绪
  storyReady: boolean;
  // 标题
  title: string;
}

// 分镜板更新结果
export interface StoryboardUpdateResult {
  // 关键分镜ID
  keyShotId: string | null;
  // 分镜列表
  shots: StoryShot[];
  // 分镜是否就绪
  storyboardReady: boolean;
  // 分镜是否过时
  storyboardStale: boolean;
}

// 单个分镜更新结果
export interface StoryShotUpdateResult {
  // 分镜
  shot: StoryShot;
  // 分镜是否就绪
  storyboardReady: boolean;
}

// 故事 Agent 工具集合
type StoryAgentTools = {
  // 确认分镜
  confirmStoryboard: {
    input: Record<string, never>;
    output: StoryboardUpdateResult;
  };
  // 呈现故事
  presentStory: {
    input: StoryDraft & { title: string };
    output: StoryDraftUpdateResult;
  };
  // 呈现分镜
  presentStoryboard: {
    input: { shots: StoryShotContent[] };
    output: StoryboardUpdateResult;
  };
  // 更新故事草稿
  updateStoryDraft: {
    input: Partial<StoryDraft> & { title?: string };
    output: StoryDraftUpdateResult;
  };
  // 更新分镜
  updateStoryShot: {
    input: Partial<StoryShotContent> & { shotId: string };
    output: StoryShotUpdateResult;
  };
};

// 故事 Agent 会话消息
export type StoryAgentMessage = UIMessage<unknown, never, StoryAgentTools>;

// 创建故事请求
export interface CreateStoryRequest {
  // 参演角色ID
  characterIds: string[];
}

// 删除故事请求
export interface DeleteStoryRequest {
  // 故事ID
  storyId: string;
}

// 保存故事会话请求
export interface SaveStoryConversationRequest {
  // 会话消息
  messages: StoryAgentMessage[];
  // 故事ID
  storyId: string;
}

// 更新故事请求
export interface UpdateStoryRequest {
  // 参演角色ID
  characterIds?: string[];
  // 是否确认分镜
  confirmStoryboard?: boolean;
  // 关键分镜ID
  keyShotId?: string;
  // 分辨率
  resolution?: CharacterVisualResolution;
  // 尺寸
  size?: IllustrationSize;
  // 故事ID
  storyId: string;
  // 标题
  title?: string;
  // 故事级默认参考
  references?: IllustrationReference[];
}

// 创建分镜请求
export interface CreateStoryShotRequest extends StoryShotContent {
  // 故事ID
  storyId: string;
  references?: IllustrationReference[];
}

// 更新分镜请求
export interface UpdateStoryShotRequest extends Partial<StoryShotContent> {
  // 分镜ID
  shotId: string;
  // 故事ID
  storyId: string;
  // 本镜覆盖参考；为空表示继承故事级参考
  references?: IllustrationReference[];
}

// 移动分镜请求
export interface MoveStoryShotRequest {
  // 移动方向（-1 上移，1 下移）
  direction: -1 | 1;
  // 分镜ID
  shotId: string;
  // 故事ID
  storyId: string;
}

// 删除分镜请求
export interface DeleteStoryShotRequest {
  // 分镜ID
  shotId: string;
  // 故事ID
  storyId: string;
}

// 生成分镜版本请求
export interface GenerateStoryShotRequest {
  // 基础版本
  baseVersion: StoryVersionReference | null;
  // 提示词
  prompt: string;
  // 分镜ID
  shotId: string;
  // 故事ID
  storyId: string;
  // 可选的本次生成参考；未传时使用已保存的镜头/故事参考
  references?: IllustrationReference[];
}

// 选中分镜版本请求
export interface SelectStoryShotVersionRequest {
  // 分镜ID
  shotId: string;
  // 故事ID
  storyId: string;
  // 版本ID
  versionId: string;
}

// 删除分镜版本请求
export type DeleteStoryShotVersionRequest = SelectStoryShotVersionRequest;

// 创建空的故事草稿
export function createEmptyStoryDraft(): StoryDraft {
  return {
    conflict: '',
    ending: '',
    goal: '',
    premise: '',
    setting: '',
    summary: '',
    tone: '',
    turningPoint: '',
  };
}

// 创建空的故事分镜内容
export function createEmptyStoryShotContent(): StoryShotContent {
  return {
    action: '',
    composition: '',
    continuity: '',
    emotion: '',
    finalPrompt: '',
    narration: '',
    purpose: '',
    scene: '',
    title: '',
  };
}

// 故事 API
export interface StoryApi {
  // 创建故事
  createStory: (request: CreateStoryRequest) => Promise<StoryProject>;
  // 创建故事分镜
  createStoryShot: (request: CreateStoryShotRequest) => Promise<StoryProject>;
  // 删除故事
  deleteStory: (request: DeleteStoryRequest) => Promise<StoryWorkspaceState>;
  // 删除故事分镜
  deleteStoryShot: (request: DeleteStoryShotRequest) => Promise<StoryProject>;
  // 删除故事分镜版本
  deleteStoryShotVersion: (request: DeleteStoryShotVersionRequest) => Promise<StoryProject>;
  // 生成故事分镜
  generateStoryShot: (request: GenerateStoryShotRequest) => Promise<StoryShotVersion>;
  // 查询故事分镜任务
  getStoryShotTask: (taskId: string) => Promise<StoryShotVersion>;
  // 查询故事工作区
  getStoryWorkspace: () => Promise<StoryWorkspaceState>;
  // 移动故事分镜
  moveStoryShot: (request: MoveStoryShotRequest) => Promise<StoryProject>;
  // 保存故事会话
  saveStoryConversation: (request: SaveStoryConversationRequest) => Promise<StoryProject>;
  // 选中故事分镜版本
  selectStoryShotVersion: (request: SelectStoryShotVersionRequest) => Promise<StoryProject>;
  // 更新故事
  updateStory: (request: UpdateStoryRequest) => Promise<StoryProject>;
  // 更新故事分镜
  updateStoryShot: (request: UpdateStoryShotRequest) => Promise<StoryShotUpdateResult>;
}
