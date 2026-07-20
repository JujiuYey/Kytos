import type { UIMessage } from 'ai';
import type {
  CharacterPortraitImage,
  CharacterPortraitResolution,
  CharacterPortraitSelection,
  CharacterPortraitTaskStatus,
} from './character-portrait';
import type { IllustrationSize } from './illustration';

export const STORY_AGENT_ENDPOINT = 'app://bundle/api/story-agent';
export const STORY_SHOT_LIMITS = { max: 6, min: 3 } as const;

export interface StoryDraft {
  conflict: string;
  ending: string;
  goal: string;
  premise: string;
  setting: string;
  summary: string;
  tone: string;
  turningPoint: string;
}

export interface StoryShotContent {
  action: string;
  composition: string;
  continuity: string;
  emotion: string;
  finalPrompt: string;
  narration: string;
  purpose: string;
  scene: string;
  title: string;
}

export interface StoryVersionReference {
  fileName: string;
  shotId: string;
  versionId: string;
}

export interface StoryShotVersion {
  baseVersion: StoryVersionReference | null;
  continuityVersion: StoryVersionReference | null;
  createdAt: string;
  errorMessage: string | null;
  id: string;
  images: CharacterPortraitImage[];
  progress: number;
  prompt: string;
  referencePortrait: CharacterPortraitSelection | null;
  referenceSheet: CharacterPortraitSelection | null;
  resolution: CharacterPortraitResolution;
  size: IllustrationSize;
  status: CharacterPortraitTaskStatus;
  updatedAt: string;
  versionNumber: number;
}

export interface StoryShot extends StoryShotContent {
  id: string;
  imageStale: boolean;
  order: number;
  selectedVersionId: string | null;
  versions: StoryShotVersion[];
}

export interface StoryProject {
  createdAt: string;
  draft: StoryDraft;
  id: string;
  keyShotId: string | null;
  messages: StoryAgentMessage[];
  resolution: CharacterPortraitResolution;
  shots: StoryShot[];
  size: IllustrationSize;
  storyboardReady: boolean;
  storyboardStale: boolean;
  storyReady: boolean;
  title: string;
  updatedAt: string;
}

export interface StoryWorkspaceState {
  stories: StoryProject[];
}

export interface StoryDraftUpdateResult {
  draft: StoryDraft;
  storyboardStale: boolean;
  storyReady: boolean;
  title: string;
}

export interface StoryboardUpdateResult {
  keyShotId: string | null;
  shots: StoryShot[];
  storyboardReady: boolean;
  storyboardStale: boolean;
}

export interface StoryShotUpdateResult {
  shot: StoryShot;
  storyboardReady: boolean;
}

type StoryAgentTools = {
  confirmStoryboard: {
    input: Record<string, never>;
    output: StoryboardUpdateResult;
  };
  presentStory: {
    input: StoryDraft & { title: string };
    output: StoryDraftUpdateResult;
  };
  presentStoryboard: {
    input: { shots: StoryShotContent[] };
    output: StoryboardUpdateResult;
  };
  updateStoryDraft: {
    input: Partial<StoryDraft> & { title?: string };
    output: StoryDraftUpdateResult;
  };
  updateStoryShot: {
    input: Partial<StoryShotContent> & { shotId: string };
    output: StoryShotUpdateResult;
  };
};

export type StoryAgentMessage = UIMessage<unknown, never, StoryAgentTools>;

export type CreateStoryRequest = Record<string, never>;

export interface DeleteStoryRequest {
  storyId: string;
}

export interface SaveStoryConversationRequest {
  messages: StoryAgentMessage[];
  storyId: string;
}

export interface UpdateStoryRequest {
  confirmStoryboard?: boolean;
  keyShotId?: string;
  resolution?: CharacterPortraitResolution;
  size?: IllustrationSize;
  storyId: string;
  title?: string;
}

export interface CreateStoryShotRequest extends StoryShotContent {
  storyId: string;
}

export interface UpdateStoryShotRequest extends Partial<StoryShotContent> {
  shotId: string;
  storyId: string;
}

export interface MoveStoryShotRequest {
  direction: -1 | 1;
  shotId: string;
  storyId: string;
}

export interface DeleteStoryShotRequest {
  shotId: string;
  storyId: string;
}

export interface GenerateStoryShotRequest {
  baseVersion: StoryVersionReference | null;
  prompt: string;
  shotId: string;
  storyId: string;
}

export interface SelectStoryShotVersionRequest {
  shotId: string;
  storyId: string;
  versionId: string;
}

export type DeleteStoryShotVersionRequest = SelectStoryShotVersionRequest;

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
