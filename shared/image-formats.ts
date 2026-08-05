// 图片 MIME 与扩展名映射的唯一真源，渲染端与主进程共用

// 保存对话框 filter 与文件名扩展名均以本表为准，避免两侧漂移
const MIME_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

// 返回该 MIME 支持的全部扩展名，供保存对话框 filter 使用
export function getMimeTypeExtensions(mimeType: string): string[] {
  return MIME_EXTENSIONS[mimeType] ?? ['png'];
}

// 返回文件名使用的单个扩展名（取首项），保证不出现多扩展名
export function getPreferredImageExtension(mimeType: string): string {
  return getMimeTypeExtensions(mimeType)[0] ?? 'png';
}
