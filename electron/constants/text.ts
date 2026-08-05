// 文本与字段长度限制、ID 正则

// 故事 / 插画标题最长字符数
export const MAX_TITLE_LENGTH = 100;
// 故事 / 插画正文单字段最长字符数（用户输入）
export const MAX_TEXT_LENGTH = 20_000;
// 持久化到 JSON 里的 prompt 字符上限
export const MAX_STORED_PROMPT_LENGTH = 50_000;
// 角色 / 表情 prompt 字段的字符上限
export const MAX_PROMPT_LENGTH = 20_000;
// 角色视觉资产名（手动命名）字符上限
export const MAX_NAME_LENGTH = 80;
// 角色动作描述最长字符数
export const MAX_CHARACTER_ACTION_LENGTH = 20_000;

// 任务编号 / 资产 ID 的统一正则
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;
