import type { CharacterWorkspaceState, SaveCharacterProfileRequest } from './character';
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
  SelectCharacterPortraitRequest,
  SelectCharacterSheetRequest,
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
  deleteCharacterPortrait: (
    request: DeleteCharacterPortraitRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  deleteCharacterSheet: (
    request: DeleteCharacterSheetRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  deleteCredential: (service: CredentialService) => Promise<CredentialStatus>;
  generateCharacterExpression: (
    request: GenerateCharacterExpressionRequest,
  ) => Promise<CharacterExpressionRecord>;
  generateCharacterPortrait: (
    request: GenerateCharacterPortraitRequest,
  ) => Promise<CharacterPortraitRecord>;
  generateCharacterSheet: (request: GenerateCharacterSheetRequest) => Promise<CharacterSheetRecord>;
  generateIllustration: (request: GenerateIllustrationRequest) => Promise<IllustrationVersion>;
  getCharacterExpressionTask: (taskId: string) => Promise<CharacterExpressionRecord>;
  getCharacterExpressionWorkspace: () => Promise<CharacterExpressionWorkspaceState>;
  getCharacterPortraitTask: (taskId: string) => Promise<CharacterPortraitRecord>;
  getCharacterPortraitWorkspace: () => Promise<CharacterPortraitWorkspaceState>;
  getCharacterSheetTask: (taskId: string) => Promise<CharacterSheetRecord>;
  getCharacterWorkspace: () => Promise<CharacterWorkspaceState>;
  getIllustrationTask: (taskId: string) => Promise<IllustrationVersion>;
  getIllustrationWorkspace: () => Promise<IllustrationWorkspaceState>;
  getCredentialStatus: (service: CredentialService) => Promise<CredentialStatus>;
  getSettings: () => Promise<DesktopSettings>;
  openWorkspaceDirectory: () => Promise<void>;
  renameCharacterExpression: (
    request: RenameCharacterExpressionRequest,
  ) => Promise<CharacterExpressionWorkspaceState>;
  selectDirectory: () => Promise<string | null>;
  saveFile: (request: SaveFileRequest) => Promise<SavedFileResult>;
  saveCharacterProfile: (request: SaveCharacterProfileRequest) => Promise<void>;
  saveIllustrationConversation: (
    request: SaveIllustrationConversationRequest,
  ) => Promise<IllustrationTopic>;
  selectCharacterPortrait: (
    request: SelectCharacterPortraitRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  selectCharacterSheet: (
    request: SelectCharacterSheetRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  selectIllustrationStyleReference: (
    request: SelectIllustrationStyleReferenceRequest,
  ) => Promise<IllustrationWorkspaceState>;
  setCredential: (request: SetCredentialRequest) => Promise<CredentialStatus>;
  setWorkspaceDirectory: (workspacePath: string) => Promise<DesktopSettings>;
  useSuggestedWorkspace: () => Promise<DesktopSettings>;
  uploadCharacterPortrait: (request: SaveFileRequest) => Promise<SavedFileResult>;
  uploadCharacterExpression: (
    request: UploadCharacterExpressionRequest,
  ) => Promise<SavedFileResult>;
  uploadCharacterSheet: (request: SaveFileRequest) => Promise<SavedFileResult>;
  uploadIllustration: (request: UploadIllustrationRequest) => Promise<UploadedIllustration>;
  updateIllustrationTopic: (request: UpdateIllustrationTopicRequest) => Promise<IllustrationTopic>;
}
