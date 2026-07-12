export interface UploadResult {
  /**
   * 文件名
   */
  fileName: string;
  /**
   * 原始文件名
   */
  originalName: string;
  /**
   * 文件 URL
   */
  url: string;
  /**
   * 文件大小
   */
  size: number;
  /**
   * 文件类型
   */
  mimeType: string;
}
