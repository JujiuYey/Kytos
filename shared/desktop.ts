import type { CharacterWorkspaceState, SaveCharacterProfileRequest } from './character';
import type {
  CharacterPortraitRecord,
  CharacterPortraitWorkspaceState,
  GenerateCharacterPortraitRequest,
  SelectCharacterPortraitRequest,
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
  deleteCredential: (service: CredentialService) => Promise<CredentialStatus>;
  generateCharacterPortrait: (
    request: GenerateCharacterPortraitRequest,
  ) => Promise<CharacterPortraitRecord>;
  getCharacterPortraitTask: (taskId: string) => Promise<CharacterPortraitRecord>;
  getCharacterPortraitWorkspace: () => Promise<CharacterPortraitWorkspaceState>;
  getCharacterWorkspace: () => Promise<CharacterWorkspaceState>;
  getCredentialStatus: (service: CredentialService) => Promise<CredentialStatus>;
  getSettings: () => Promise<DesktopSettings>;
  openWorkspaceDirectory: () => Promise<void>;
  selectDirectory: () => Promise<string | null>;
  saveFile: (request: SaveFileRequest) => Promise<SavedFileResult>;
  saveCharacterProfile: (request: SaveCharacterProfileRequest) => Promise<void>;
  selectCharacterPortrait: (
    request: SelectCharacterPortraitRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  setCredential: (request: SetCredentialRequest) => Promise<CredentialStatus>;
  setWorkspaceDirectory: (workspacePath: string) => Promise<DesktopSettings>;
  useSuggestedWorkspace: () => Promise<DesktopSettings>;
}
