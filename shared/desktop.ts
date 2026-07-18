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
  getCharacterExpressionTask: (taskId: string) => Promise<CharacterExpressionRecord>;
  getCharacterExpressionWorkspace: () => Promise<CharacterExpressionWorkspaceState>;
  getCharacterPortraitTask: (taskId: string) => Promise<CharacterPortraitRecord>;
  getCharacterPortraitWorkspace: () => Promise<CharacterPortraitWorkspaceState>;
  getCharacterSheetTask: (taskId: string) => Promise<CharacterSheetRecord>;
  getCharacterWorkspace: () => Promise<CharacterWorkspaceState>;
  getCredentialStatus: (service: CredentialService) => Promise<CredentialStatus>;
  getSettings: () => Promise<DesktopSettings>;
  openWorkspaceDirectory: () => Promise<void>;
  renameCharacterExpression: (
    request: RenameCharacterExpressionRequest,
  ) => Promise<CharacterExpressionWorkspaceState>;
  selectDirectory: () => Promise<string | null>;
  saveFile: (request: SaveFileRequest) => Promise<SavedFileResult>;
  saveCharacterProfile: (request: SaveCharacterProfileRequest) => Promise<void>;
  selectCharacterPortrait: (
    request: SelectCharacterPortraitRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  selectCharacterSheet: (
    request: SelectCharacterSheetRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  setCredential: (request: SetCredentialRequest) => Promise<CredentialStatus>;
  setWorkspaceDirectory: (workspacePath: string) => Promise<DesktopSettings>;
  useSuggestedWorkspace: () => Promise<DesktopSettings>;
  uploadCharacterPortrait: (request: SaveFileRequest) => Promise<SavedFileResult>;
  uploadCharacterExpression: (
    request: UploadCharacterExpressionRequest,
  ) => Promise<SavedFileResult>;
  uploadCharacterSheet: (request: SaveFileRequest) => Promise<SavedFileResult>;
}
