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
  getCredentialStatus: (service: CredentialService) => Promise<CredentialStatus>;
  getSettings: () => Promise<DesktopSettings>;
  openWorkspaceDirectory: () => Promise<void>;
  selectDirectory: () => Promise<string | null>;
  saveFile: (request: SaveFileRequest) => Promise<SavedFileResult>;
  setCredential: (request: SetCredentialRequest) => Promise<CredentialStatus>;
  setWorkspaceDirectory: (workspacePath: string) => Promise<DesktopSettings>;
  useSuggestedWorkspace: () => Promise<DesktopSettings>;
}
