// 角色库与角色作用域的类型定义
import type { CharacterImageSize } from './character-portrait';

// 角色概要
export interface CharacterSummary {
  // 创建时间
  createdAt: string;
  // 角色ID
  id: string;
  // 角色名称
  name: string;
  // 更新时间
  updatedAt: string;
}

// 角色库中的视觉素材
export interface CharacterLibraryVisualAsset {
  // 素材类型（头像 / 设定图）
  kind: 'portrait' | 'sheet';
  // 素材名称
  name: string;
  // 素材尺寸
  size: CharacterImageSize;
  // 访问地址
  url: string;
}

// 角色库中的角色条目
export interface CharacterLibraryCharacter extends CharacterSummary {
  // 当前官方视觉素材
  visualAsset: CharacterLibraryVisualAsset | null;
}

// 角色库状态
export interface CharacterLibraryState {
  // 当前选中角色ID
  activeCharacterId: string;
  // 角色列表
  characters: CharacterLibraryCharacter[];
}

// 创建角色请求
export interface CreateCharacterRequest {
  // 角色名称
  name: string;
}

// 删除角色请求
export interface DeleteCharacterRequest {
  // 角色ID
  characterId: string;
}

// 选中角色请求
export interface SelectCharacterRequest {
  // 角色ID
  characterId: string;
}

// 更新角色概要请求
export interface UpdateCharacterRequest extends SelectCharacterRequest {
  // 角色名称
  name: string;
}

// 角色作用域请求（带角色ID的通用入参）
export interface CharacterScopeRequest {
  // 角色ID
  characterId: string;
}

// 角色库 API
export interface CharacterLibraryApi {
  // 创建角色概要
  createCharacter: (request: CreateCharacterRequest) => Promise<CharacterLibraryState>;
  // 删除角色
  deleteCharacter: (request: DeleteCharacterRequest) => Promise<CharacterLibraryState>;
  // 查询角色库
  getCharacterLibrary: () => Promise<CharacterLibraryState>;
  // 选中角色
  selectCharacter: (request: SelectCharacterRequest) => Promise<CharacterLibraryState>;
  // 更新角色概要
  updateCharacter: (request: UpdateCharacterRequest) => Promise<CharacterLibraryState>;
}
