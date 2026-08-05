// illustration 模块持久化类型
import type { IllustrationTopic, UploadedIllustration } from '../../../shared/illustration';

export interface StoredIllustrationWorkspace {
  topics: IllustrationTopic[];
  uploads: UploadedIllustration[];
  version: 4;
}
