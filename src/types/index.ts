export type {
  CredentialService,
  CredentialStatus,
  DesktopApi,
  DesktopSettings,
  SavedFileResult,
  SaveFileRequest,
  SetCredentialRequest,
} from '../../shared/desktop';
export type {
  CharacterAgentMessage,
  CharacterDraft,
  CharacterDraftField,
  CharacterDraftPatch,
  CharacterDraftUpdateResult,
  CharacterProfileProposalResult,
  CharacterWorkspaceState,
  SaveCharacterProfileRequest,
} from '../../shared/character';
export type {
  CharacterPortraitImage,
  CharacterPortraitRecord,
  CharacterPortraitResolution,
  CharacterPortraitSelection,
  CharacterPortraitSize,
  CharacterPortraitTaskStatus,
  CharacterPortraitWorkspaceState,
  GenerateCharacterPortraitRequest,
  SelectCharacterPortraitRequest,
} from '../../shared/character-portrait';
export {
  CHARACTER_AGENT_ENDPOINT,
  CHARACTER_DRAFT_FIELDS,
  DEFAULT_DEEPSEEK_MODEL,
  createEmptyCharacterDraft,
  getCharacterDraftProgress,
} from '../../shared/character';
export {
  CHARACTER_PORTRAIT_RESOLUTIONS,
  CHARACTER_PORTRAIT_SIZES,
} from '../../shared/character-portrait';
export * from './setting';
