// 桌面文件 IO 类型

// 保存文件请求
export interface SaveFileRequest {
  // 文件名
  fileName: string;
  // 文件二进制内容
  fileData: Uint8Array;
  // MIME 类型
  mimeType: string;
}

// 已保存文件结果
export interface SavedFileResult {
  // 文件名
  fileName: string;
  // 原始文件名
  originalName: string;
  // 访问地址
  url: string;
  // 文件大小
  size: number;
  // MIME 类型
  mimeType: string;
}

// 导出文件请求
export interface ExportFileRequest {
  fileName: string;
  fileData: Uint8Array;
  mimeType: string;
}

// 导出文件结果
export interface ExportFileResult {
  canceled: boolean;
  filePath: string | null;
}

// 文件 API
export interface FileApi {
  // 导出文件到用户选择的位置
  exportFile: (request: ExportFileRequest) => Promise<ExportFileResult>;
  // 保存文件
  saveFile: (request: SaveFileRequest) => Promise<SavedFileResult>;
}
