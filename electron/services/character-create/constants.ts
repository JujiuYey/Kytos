// character-create 模块本地常量
import { WORKSPACE_ASSETS_SUBDIRECTORY } from '../../constants';

// 角色视觉候选图片在工作区下的子目录名（与 character-visual / story / illustration 等独立）
export const ASSET_DIRECTORY = 'character-candidates';

// 一轮生成允许的参考图上限
export const IMAGE_URL_LIMIT = 16;
// size 字段格式：例如 "1:1"、"16:9"
export const IMAGE_SIZE_PATTERN = /^\d{1,2}:\d{1,2}$/;
// 生成接口允许的清晰度
export const GENERATION_RESOLUTIONS: readonly string[] = ['1k', '2k', '4k'];
// 一次请求允许的最大候选数量
export const GENERATION_N_MIN = 1;
export const GENERATION_N_MAX = 10;

export { WORKSPACE_ASSETS_SUBDIRECTORY };
