// story 服务相关类型
import type { CharacterVisualImage } from '../../../shared/character-visual';
import type { StoryProject } from '../../../shared/story';

export interface StoredStoryWorkspace {
  stories: StoryProject[];
  version: 3;
}

export interface DownloadedImage {
  fileName: string;
  mimeType: string;
  url: string;
}

export type { CharacterVisualImage };
