import type { CharacterWorkspaceState, SaveCharacterProfileRequest } from './character';
import type {
  CharacterLibraryState,
  CreateCharacterRequest,
  DeleteCharacterRequest,
  SelectCharacterRequest,
  UpdateCharacterRequest,
} from './character-library';
import type {
  CharacterExpressionRecord,
  CharacterExpressionWorkspaceState,
  DeleteCharacterExpressionRequest,
  GenerateCharacterExpressionRequest,
  RenameCharacterExpressionRequest,
  UploadCharacterExpressionRequest,
} from './character-expression';
import type {
  CharacterPortraitRecord,
  CharacterPortraitWorkspaceState,
  CharacterSheetRecord,
  DeleteCharacterPortraitRequest,
  DeleteCharacterSheetRequest,
  GenerateCharacterPortraitRequest,
  GenerateCharacterSheetRequest,
  RenameCharacterVisualAssetRequest,
  SelectCharacterPortraitRequest,
  SelectCharacterSheetRequest,
  SetCharacterVisualAssetOfficialRequest,
  UploadCharacterVisualAssetRequest,
} from './character-portrait';
import type {
  CreateIllustrationTopicRequest,
  DeleteIllustrationUploadRequest,
  DeleteIllustrationTopicRequest,
  DeleteIllustrationVersionRequest,
  GenerateIllustrationRequest,
  IllustrationTopic,
  IllustrationVersion,
  IllustrationWorkspaceState,
  SaveIllustrationConversationRequest,
  SelectIllustrationStyleReferenceRequest,
  UpdateIllustrationTopicRequest,
  UploadedIllustration,
  UploadIllustrationRequest,
} from './illustration';
import type {
  CreateStoryRequest,
  CreateStoryShotRequest,
  DeleteStoryRequest,
  DeleteStoryShotRequest,
  DeleteStoryShotVersionRequest,
  GenerateStoryShotRequest,
  MoveStoryShotRequest,
  SaveStoryConversationRequest,
  SelectStoryShotVersionRequest,
  StoryProject,
  StoryShotUpdateResult,
  StoryShotVersion,
  StoryWorkspaceState,
  UpdateStoryRequest,
  UpdateStoryShotRequest,
} from './story';

export type CredentialService = 'apimart' | 'deepseek';

export interface DesktopSettings {
  suggestedWorkspacePath: string;
  workspacePath: string | null;
}

export interface CredentialStatus {
  configured: boolean;
  secureStorageAvailable: boolean;
  service: CredentialService;
}

export interface SetCredentialRequest {
  service: CredentialService;
  value: string;
}

export interface SaveFileRequest {
  fileName: string;
  fileData: Uint8Array;
  mimeType: string;
}

export interface SavedFileResult {
  fileName: string;
  originalName: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface DesktopApi {
  createCharacter: (request: CreateCharacterRequest) => Promise<CharacterLibraryState>;
  createStory: (request: CreateStoryRequest) => Promise<StoryProject>;
  createStoryShot: (request: CreateStoryShotRequest) => Promise<StoryProject>;
  createIllustrationTopic: (request: CreateIllustrationTopicRequest) => Promise<IllustrationTopic>;
  deleteIllustrationTopic: (
    request: DeleteIllustrationTopicRequest,
  ) => Promise<IllustrationWorkspaceState>;
  deleteIllustrationVersion: (
    request: DeleteIllustrationVersionRequest,
  ) => Promise<IllustrationTopic>;
  deleteIllustrationUpload: (
    request: DeleteIllustrationUploadRequest,
  ) => Promise<IllustrationWorkspaceState>;
  deleteCharacterExpression: (
    request: DeleteCharacterExpressionRequest,
  ) => Promise<CharacterExpressionWorkspaceState>;
  deleteCharacter: (request: DeleteCharacterRequest) => Promise<CharacterLibraryState>;
  deleteCharacterPortrait: (
    request: DeleteCharacterPortraitRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  deleteCharacterSheet: (
    request: DeleteCharacterSheetRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  deleteCredential: (service: CredentialService) => Promise<CredentialStatus>;
  deleteStory: (request: DeleteStoryRequest) => Promise<StoryWorkspaceState>;
  deleteStoryShot: (request: DeleteStoryShotRequest) => Promise<StoryProject>;
  deleteStoryShotVersion: (request: DeleteStoryShotVersionRequest) => Promise<StoryProject>;
  generateCharacterExpression: (
    request: GenerateCharacterExpressionRequest,
  ) => Promise<CharacterExpressionRecord>;
  generateCharacterPortrait: (
    request: GenerateCharacterPortraitRequest,
  ) => Promise<CharacterPortraitRecord>;
  generateCharacterSheet: (request: GenerateCharacterSheetRequest) => Promise<CharacterSheetRecord>;
  generateIllustration: (request: GenerateIllustrationRequest) => Promise<IllustrationVersion>;
  generateStoryShot: (request: GenerateStoryShotRequest) => Promise<StoryShotVersion>;
  getCharacterExpressionTask: (taskId: string) => Promise<CharacterExpressionRecord>;
  getCharacterExpressionWorkspace: () => Promise<CharacterExpressionWorkspaceState>;
  getCharacterLibrary: () => Promise<CharacterLibraryState>;
  getCharacterPortraitTask: (taskId: string) => Promise<CharacterPortraitRecord>;
  getCharacterPortraitWorkspace: () => Promise<CharacterPortraitWorkspaceState>;
  getCharacterSheetTask: (taskId: string) => Promise<CharacterSheetRecord>;
  getCharacterWorkspace: () => Promise<CharacterWorkspaceState>;
  getIllustrationTask: (taskId: string) => Promise<IllustrationVersion>;
  getIllustrationWorkspace: () => Promise<IllustrationWorkspaceState>;
  getStoryShotTask: (taskId: string) => Promise<StoryShotVersion>;
  getStoryWorkspace: () => Promise<StoryWorkspaceState>;
  getCredentialStatus: (service: CredentialService) => Promise<CredentialStatus>;
  getSettings: () => Promise<DesktopSettings>;
  openWorkspaceDirectory: () => Promise<void>;
  moveStoryShot: (request: MoveStoryShotRequest) => Promise<StoryProject>;
  renameCharacterExpression: (
    request: RenameCharacterExpressionRequest,
  ) => Promise<CharacterExpressionWorkspaceState>;
  renameCharacterVisualAsset: (
    request: RenameCharacterVisualAssetRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  selectDirectory: () => Promise<string | null>;
  saveFile: (request: SaveFileRequest) => Promise<SavedFileResult>;
  saveCharacterProfile: (request: SaveCharacterProfileRequest) => Promise<void>;
  saveIllustrationConversation: (
    request: SaveIllustrationConversationRequest,
  ) => Promise<IllustrationTopic>;
  saveStoryConversation: (request: SaveStoryConversationRequest) => Promise<StoryProject>;
  selectCharacterPortrait: (
    request: SelectCharacterPortraitRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  selectCharacter: (request: SelectCharacterRequest) => Promise<CharacterLibraryState>;
  selectCharacterSheet: (
    request: SelectCharacterSheetRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  selectIllustrationStyleReference: (
    request: SelectIllustrationStyleReferenceRequest,
  ) => Promise<IllustrationWorkspaceState>;
  selectStoryShotVersion: (request: SelectStoryShotVersionRequest) => Promise<StoryProject>;
  setCredential: (request: SetCredentialRequest) => Promise<CredentialStatus>;
  setCharacterVisualAssetOfficial: (
    request: SetCharacterVisualAssetOfficialRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  setWorkspaceDirectory: (workspacePath: string) => Promise<DesktopSettings>;
  useSuggestedWorkspace: () => Promise<DesktopSettings>;
  uploadCharacterPortrait: (request: SaveFileRequest) => Promise<SavedFileResult>;
  uploadCharacterVisualAsset: (
    request: UploadCharacterVisualAssetRequest,
  ) => Promise<SavedFileResult>;
  uploadCharacterExpression: (
    request: UploadCharacterExpressionRequest,
  ) => Promise<SavedFileResult>;
  uploadCharacterSheet: (request: SaveFileRequest) => Promise<SavedFileResult>;
  uploadIllustration: (request: UploadIllustrationRequest) => Promise<UploadedIllustration>;
  updateIllustrationTopic: (request: UpdateIllustrationTopicRequest) => Promise<IllustrationTopic>;
  updateCharacter: (request: UpdateCharacterRequest) => Promise<CharacterLibraryState>;
  updateStory: (request: UpdateStoryRequest) => Promise<StoryProject>;
  updateStoryShot: (request: UpdateStoryShotRequest) => Promise<StoryShotUpdateResult>;
}
