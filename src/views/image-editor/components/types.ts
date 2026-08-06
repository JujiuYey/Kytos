export type CropRatio = 'free' | '1:1' | '3:4' | '4:5' | '16:9';
export type CompressionMode = 'quality' | 'target-size';
export type ExportFormat = 'jpeg' | 'png' | 'webp';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
