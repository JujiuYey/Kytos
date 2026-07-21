// 角色创建 Agent 与视觉素材生成的类型定义
import type { UIMessage } from 'ai';
import type { CharacterPortraitImage, CharacterPortraitTaskStatus } from './character-portrait';

// 角色创建 Agent 端点
export const CHARACTER_CREATE_AGENT_ENDPOINT = 'app://bundle/api/character-create-agent';

// 角色创建草稿
export interface CharacterCreateDraft {
  // 配饰
  accessories: string;
  // 点缀色
  accentColor: string;
  // 年龄
  age: string;
  // 背景色
  backgroundColor: string;
  // 下装颜色
  bottomsColor: string;
  // 下装长度
  bottomsLength: string;
  // 下装风格
  bottomsStyle: string;
  // 角色气质
  characterMood: string;
  // 上装颜色
  clothingColor: string;
  // 上装长度
  clothingLength: string;
  // 上装风格
  clothingStyle: string;
  // 禁用色
  forbiddenColors: string;
  // 性别
  gender: string;
  // 发色
  hairColor: string;
  // 发型
  hairstyle: string;
  // 整体风格关键词
  overallStyleKeywords: string;
  // 主色
  primaryColor: string;
  // 道具
  props: string;
  // 辅色
  secondaryColor: string;
  // 鞋子颜色
  shoesColor: string;
  // 鞋跟高度
  shoesHeight: string;
  // 鞋子风格
  shoesStyle: string;
}

// 角色创建草稿更新结果
export interface CharacterCreateDraftUpdateResult {
  // 最新草稿
  draft: CharacterCreateDraft;
  // 本次被更新的字段列表
  updatedFields: Array<keyof CharacterCreateDraft>;
}

// 角色创建提示词结果
export interface CharacterCreatePromptResult {
  // 草稿
  draft: CharacterCreateDraft;
  // 定稿后的提示词
  prompt: string;
  // 是否就绪
  ready: true;
}

// 角色创建 Agent 工具集合
type CharacterCreateAgentTools = {
  // 定稿角色提示词
  finalizeCharacterPrompt: {
    input: { draft: Partial<CharacterCreateDraft>; prompt: string };
    output: CharacterCreatePromptResult;
  };
  // 更新角色草稿
  updateCharacterDraft: {
    input: Partial<CharacterCreateDraft>;
    output: CharacterCreateDraftUpdateResult;
  };
};

// 角色创建 Agent 会话消息
export type CharacterCreateAgentMessage = UIMessage<unknown, never, CharacterCreateAgentTools>;

// 角色视觉参考图
export interface CharacterVisualReferenceImage {
  // 文件二进制内容
  fileData: Uint8Array;
  // 文件名
  fileName: string;
  // MIME 类型
  mimeType: string;
}

// 生成角色视觉素材请求
export interface GenerateCharacterVisualRequest {
  // 提示词
  prompt: string;
  // 参考图（可选）
  referenceImage?: CharacterVisualReferenceImage;
}

// 查询角色视觉素材生成结果请求
export interface GetCharacterVisualGenerationRequest {
  // 生成任务ID
  generationId: string;
}

// 保存角色视觉素材请求
export interface SaveCharacterVisualRequest {
  // 目标角色ID（可选，不传则新建角色）
  characterId?: string;
  // 生成任务ID
  generationId: string;
}

// 保存角色视觉素材资源请求
export interface SaveCharacterVisualAssetRequest extends CharacterVisualReferenceImage {
  // 所属角色ID（可选）
  characterId?: string;
  // 素材名称（可选）
  name?: string;
}

// 保存角色视觉素材结果
export interface SaveCharacterVisualResult {
  // 角色ID
  characterId: string;
  // 更新后的角色库状态
  library: import('./character-library').CharacterLibraryState;
}

// 角色视觉素材生成任务
export interface CharacterVisualGeneration {
  // 创建时间
  createdAt: string;
  // 错误信息
  errorMessage: string | null;
  // 任务ID
  id: string;
  // 生成的图片
  image: CharacterPortraitImage | null;
  // 生成进度
  progress: number;
  // 任务状态
  status: CharacterPortraitTaskStatus;
  // 更新时间
  updatedAt: string;
}
