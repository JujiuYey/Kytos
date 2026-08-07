// character-visual 模块本地常量：与业务强绑定的字段、目录名、限制
import {
  MAX_NAME_LENGTH,
  MAX_PROMPT_LENGTH,
  MAX_REFERENCE_IMAGE_SIZE,
  MAX_RESULT_IMAGE_SIZE,
  MAX_STORED_PROMPT_LENGTH,
} from '../../constants';

export const LEGACY_ACTION_ASSET_DIRECTORY = 'character-portraits';
export const LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY = 'character-sheets';

// 重新导出，让 character-visual 子模块仍能从 './constants' 拿到这些限制
export {
  MAX_NAME_LENGTH,
  MAX_PROMPT_LENGTH,
  MAX_REFERENCE_IMAGE_SIZE,
  MAX_RESULT_IMAGE_SIZE,
  MAX_STORED_PROMPT_LENGTH,
};
