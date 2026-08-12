import type {
  CharacterVisualAssetSelection,
  GenerateCharacterActionPromptRequest,
  GenerateCharacterActionRequest,
  GenerateCharacterReferenceBoardRequest,
  RenameCharacterVisualAssetRequest,
  SaveCharacterVisualAssetRequest,
  SetCharacterVisualAssetOfficialRequest,
  UploadCharacterVisualAssetRequest,
} from '@/types';
import type { CharacterScopeRequest } from '@/types';

export const characterAnchorApi = {
  deleteAnchor(request: CharacterVisualAssetSelection) {
    return window.desktop.character.assets.deleteCharacterVisualAsset(request);
  },
  generateAction(request: GenerateCharacterActionRequest) {
    return window.desktop.character.assets.generateCharacterAction(request);
  },
  generateActionPrompt(request: GenerateCharacterActionPromptRequest) {
    return window.desktop.character.assets.generateCharacterActionPrompt(request);
  },
  generateReferenceBoard(request: GenerateCharacterReferenceBoardRequest) {
    return window.desktop.character.assets.generateCharacterReferenceBoard(request);
  },
  getTask(taskId: string) {
    return window.desktop.character.assets.getCharacterVisualAssetTask(taskId);
  },
  getWorkspace(request?: CharacterScopeRequest) {
    return window.desktop.character.assets.getCharacterVisualWorkspace(request);
  },
  renameAnchor(request: RenameCharacterVisualAssetRequest) {
    return window.desktop.character.assets.renameCharacterVisualAsset(request);
  },
  setOfficial(request: SetCharacterVisualAssetOfficialRequest) {
    return window.desktop.character.assets.setCharacterVisualAssetOfficial(request);
  },
  uploadAnchor(request: UploadCharacterVisualAssetRequest) {
    return window.desktop.character.assets.uploadCharacterVisualAsset(request);
  },
};

export const characterAnchorUploadApi = {
  save(request: SaveCharacterVisualAssetRequest) {
    return window.desktop.character.assets.saveCharacterVisualAsset(request);
  },
};
