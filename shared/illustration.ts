import type { UIMessage } from 'ai';
import type {
  CharacterPortraitImage,
  CharacterPortraitResolution,
  CharacterPortraitSelection,
  CharacterPortraitTaskStatus,
} from './character-portrait';
import type { ArtStyle } from './art-style';

export const ILLUSTRATION_AGENT_ENDPOINT = 'app://bundle/api/illustration-agent';
export const ILLUSTRATION_SIZES = ['1:1', '3:4', '4:5', '16:9', '9:16'] as const;
export type IllustrationSize = (typeof ILLUSTRATION_SIZES)[number];

export interface IllustrationBrief {
  action: string;
  composition: string;
  details: string;
  environment: string;
  finalPrompt: string;
  mood: string;
  style: string;
  subject: string;
}

export interface IllustrationBriefUpdateResult {
  brief: IllustrationBrief;
  ready: boolean;
  title: string;
}

type IllustrationAgentTools = {
  presentIllustrationPlan: {
    input: IllustrationBrief & { title: string };
    output: IllustrationBriefUpdateResult;
  };
  updateIllustrationBrief: {
    input: Partial<IllustrationBrief> & { title?: string };
    output: IllustrationBriefUpdateResult;
  };
};

export type IllustrationAgentMessage = UIMessage<unknown, never, IllustrationAgentTools>;

export interface IllustrationVersionReference {
  fileName: string;
  versionId: string;
}

export type IllustrationStyleReference =
  | {
      fileName: string;
      source: 'generated';
      topicId: string;
      versionId: string;
    }
  | {
      fileName: string;
      source: 'uploaded';
      uploadId: string;
    };

export interface IllustrationVersion {
  artStyleId: string | null;
  artStyleName: string | null;
  baseVersion: IllustrationVersionReference | null;
  createdAt: string;
  errorMessage: string | null;
  id: string;
  images: CharacterPortraitImage[];
  progress: number;
  prompt: string;
  referencePortrait: CharacterPortraitSelection | null;
  referenceSheet: CharacterPortraitSelection | null;
  referenceStyle: IllustrationStyleReference | null;
  resolution: CharacterPortraitResolution;
  size: IllustrationSize;
  status: CharacterPortraitTaskStatus;
  updatedAt: string;
  useCharacter: boolean;
  versionNumber: number;
}

export interface IllustrationTopic {
  brief: IllustrationBrief;
  createdAt: string;
  id: string;
  messages: IllustrationAgentMessage[];
  ready: boolean;
  title: string;
  updatedAt: string;
  useCharacter: boolean;
  versions: IllustrationVersion[];
}

export interface UploadedIllustration {
  createdAt: string;
  fileName: string;
  id: string;
  mimeType: string;
  originalName: string;
  size: number;
  url: string;
}

export interface IllustrationWorkspaceState {
  activeArtStyle: ArtStyle;
  selectedStyleReference: IllustrationStyleReference | null;
  topics: IllustrationTopic[];
  uploads: UploadedIllustration[];
}

export interface CreateIllustrationTopicRequest {
  useCharacter: boolean;
}

export interface UpdateIllustrationTopicRequest {
  title?: string;
  topicId: string;
  useCharacter?: boolean;
}

export interface SaveIllustrationConversationRequest {
  messages: IllustrationAgentMessage[];
  topicId: string;
}

export interface GenerateIllustrationRequest {
  baseVersion: IllustrationVersionReference | null;
  prompt: string;
  resolution: CharacterPortraitResolution;
  size: IllustrationSize;
  topicId: string;
}

export interface DeleteIllustrationTopicRequest {
  topicId: string;
}

export interface DeleteIllustrationVersionRequest {
  topicId: string;
  versionId: string;
}

export interface DeleteIllustrationUploadRequest {
  uploadId: string;
}

export type SelectIllustrationStyleReferenceRequest = IllustrationStyleReference & {
  name?: string;
};

export interface UploadIllustrationRequest {
  fileData: Uint8Array;
  fileName: string;
  mimeType: string;
}

export function createEmptyIllustrationBrief(): IllustrationBrief {
  return {
    action: '',
    composition: '',
    details: '',
    environment: '',
    finalPrompt: '',
    mood: '',
    style: '',
    subject: '',
  };
}
