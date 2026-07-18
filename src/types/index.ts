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
  CharacterExpressionRecord,
  CharacterExpressionSize,
  CharacterExpressionWorkspaceState,
  DeleteCharacterExpressionRequest,
  GenerateCharacterExpressionRequest,
  RenameCharacterExpressionRequest,
  UploadCharacterExpressionRequest,
} from '../../shared/character-expression';
export { CHARACTER_EXPRESSION_SIZES } from '../../shared/character-expression';
export type {
  CharacterImageRecord,
  CharacterImageSource,
  CharacterPortraitImage,
  CharacterPortraitRecord,
  CharacterPortraitResolution,
  CharacterPortraitSelection,
  CharacterPortraitSize,
  CharacterPortraitTaskStatus,
  CharacterPortraitWorkspaceState,
  CharacterSheetRecord,
  DeleteCharacterPortraitRequest,
  DeleteCharacterSheetRequest,
  GenerateCharacterPortraitRequest,
  GenerateCharacterSheetRequest,
  SelectCharacterPortraitRequest,
  SelectCharacterSheetRequest,
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
  CHARACTER_SHEET_SIZE,
} from '../../shared/character-portrait';
export type {
  CreateIllustrationTopicRequest,
  DeleteIllustrationUploadRequest,
  DeleteIllustrationTopicRequest,
  DeleteIllustrationVersionRequest,
  GenerateIllustrationRequest,
  IllustrationAgentMessage,
  IllustrationBrief,
  IllustrationBriefUpdateResult,
  IllustrationSize,
  IllustrationStyleReference,
  IllustrationTopic,
  IllustrationVersion,
  IllustrationVersionReference,
  IllustrationWorkspaceState,
  SaveIllustrationConversationRequest,
  SelectIllustrationStyleReferenceRequest,
  UpdateIllustrationTopicRequest,
  UploadedIllustration,
  UploadIllustrationRequest,
} from '../../shared/illustration';
export {
  ILLUSTRATION_AGENT_ENDPOINT,
  ILLUSTRATION_SIZES,
  ILLUSTRATION_STYLE_GUIDANCE,
  createEmptyIllustrationBrief,
} from '../../shared/illustration';
export * from './setting';
