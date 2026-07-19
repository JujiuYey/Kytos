import type { CharacterPortraitImage } from './character-portrait';

export const MINIMAL_LINE_ART_STYLE_ID = 'preset-minimal-line-art';

export type ArtStyleSource = 'custom' | 'preset';

export interface ArtStyleReferenceImage extends CharacterPortraitImage {
  directory: 'art-styles';
}

export interface ArtStyle {
  createdAt: string;
  description: string;
  id: string;
  name: string;
  palette: string[];
  prompt: string;
  referenceImage: ArtStyleReferenceImage | null;
  source: ArtStyleSource;
  updatedAt: string;
}

export interface ArtStyleWorkspaceState {
  styles: ArtStyle[];
}

export interface SaveArtStyleRequest {
  description: string;
  id?: string;
  name: string;
  prompt: string;
  referenceImage?: {
    fileData: Uint8Array;
    fileName: string;
    mimeType: string;
  } | null;
}

export interface DeleteArtStyleRequest {
  id: string;
}
