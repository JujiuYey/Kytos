// character-library 模块本地常量
// 角色库 JSON 文件名
export const STORE_FILE_NAME = 'character-library.json';
// 工作区下的角色目录
export const CHARACTER_DIRECTORY = 'characters';

// 历史遗留的角色资产文件名 / 资源子目录（character-visual 后续迁移前的兼容读取）
export const LEGACY_VISUAL_STORE_FILE_NAME = 'character-portraits.json';
export const LEGACY_ACTION_ASSET_DIRECTORY = 'character-portraits';
export const LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY = 'character-sheets';
export const LEGACY_CHARACTER_FILES = [
  'character-draft.json',
  'character-expressions.json',
  'character-portraits.json',
  'ip.md',
] as const;

// 角色名最长字符数
export const MAX_NAME_LENGTH = 100;

// character_<uuid> 形式的 ID 正则
export const ID_PATTERN = /^character_[A-Za-z0-9-]{1,200}$/;

// 角色库持久化文件当前 schema 版本
export const STORE_VERSION = 2;
