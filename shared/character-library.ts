export interface CharacterSummary {
  createdAt: string;
  id: string;
  name: string;
  updatedAt: string;
}

export interface CharacterLibraryState {
  activeCharacterId: string;
  characters: CharacterSummary[];
}

export interface CreateCharacterRequest {
  name: string;
}

export interface UpdateCharacterRequest {
  characterId: string;
  name: string;
}

export interface DeleteCharacterRequest {
  characterId: string;
}

export interface SelectCharacterRequest {
  characterId: string;
}
