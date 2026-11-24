// apimart 上传接口，以及参考图提交前的准备
// 上传接口文档：https://docs.apimart.ai/cn/api-reference/uploads/images
// 约束（按文档）：
//   - multipart/form-data，字段名 file，要带文件名；支持 JPEG / PNG / GIF / WebP，单文件不超过 30MB
//   - 成功返回 { url, ... }，url 在顶层，没有 data 包装；文件到期后 URL 失效
//   - retention_days=3 在账户免费额度内免费；省略时沿用控制台默认档，可能是收费的 7 / 15 / 30 天
import { randomBytes } from 'node:crypto';
import { isPlainObject } from 'es-toolkit';
import { API_BASE_URL } from '../constants/api';
import { IMAGE_MODEL_DEFINITIONS } from '../../shared/image-model';
import type { ImageModel } from '../../shared/image-model';
import { requestApi } from './http';

// 上传接口的单文件上限
export const MAX_UPLOAD_IMAGE_BYTES = 30 * 1024 * 1024;

const UPLOAD_IMAGE_URL = `${API_BASE_URL}/v1/uploads/images?retention_days=3`;
// 上传接口按文件内容识别类型，这里的扩展名只用于文件名
const UPLOAD_FILE_EXTENSIONS: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const DATA_URI_HEADER_PATTERN = /^data:(image\/[a-z0-9.+-]+);base64$/i;

// 按模型把参考图准备成生成接口收的形式，顺序不变：
// 收 data URI 的模型（Nano Banana 2.1、Seedream 5.5、MiniMax H3 Image）原样传入，不必上传；其余模型要把 data URI 换成公网 URL
export async function prepareImageReferences(
  imageUrls: string[] | undefined,
  model: ImageModel,
  apiKey: string,
): Promise<string[] | undefined> {
  return IMAGE_MODEL_DEFINITIONS[model].acceptsDataUriReferences
    ? imageUrls
    : uploadReferenceImages(imageUrls, apiKey);
}

// 把参考图列表里的 data URI 逐张换成公网 URL；已是链接的原样保留。
// 空列表原样返回，调用方可直接交给请求体构造
async function uploadReferenceImages(
  imageUrls: string[] | undefined,
  apiKey: string,
): Promise<string[] | undefined> {
  if (!imageUrls) return undefined;
  // 逐张上传而不是并发：超时按单个请求计，并发时会平分带宽，参考图一多容易一起超时
  const uploaded: string[] = [];
  for (const imageUrl of imageUrls) {
    uploaded.push(imageUrl.startsWith('data:') ? await uploadDataUri(imageUrl, apiKey) : imageUrl);
  }
  return uploaded;
}

async function uploadDataUri(dataUri: string, apiKey: string): Promise<string> {
  // 只把头部交给正则，不扫描整段 base64
  const commaIndex = dataUri.indexOf(',');
  const headerMatch =
    commaIndex < 0 ? null : DATA_URI_HEADER_PATTERN.exec(dataUri.slice(0, commaIndex));
  if (!headerMatch) {
    throw new Error('参考图数据无效，无法上传');
  }
  const mimeType = headerMatch[1].toLowerCase();
  const fileData = Buffer.from(dataUri.slice(commaIndex + 1), 'base64');
  if (fileData.byteLength === 0) {
    throw new Error('参考图数据无效，无法上传');
  }
  if (fileData.byteLength > MAX_UPLOAD_IMAGE_BYTES) {
    throw new Error(`参考图超过 ${MAX_UPLOAD_IMAGE_BYTES / 1024 / 1024} MB，无法上传`);
  }

  const boundary = randomBytes(16).toString('hex');
  let payload: unknown;
  try {
    payload = await requestApi(UPLOAD_IMAGE_URL, {
      body: buildMultipartBody(
        boundary,
        `reference.${UPLOAD_FILE_EXTENSIONS[mimeType] ?? 'png'}`,
        mimeType,
        fileData,
      ),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      method: 'POST',
    });
  } catch (error: unknown) {
    throw new Error(`参考图上传失败：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isPlainObject(payload) || typeof payload.url !== 'string') {
    throw new Error('参考图上传失败：上传接口没有返回图片地址');
  }
  return payload.url;
}

// 按 multipart/form-data 规则把单个文件拼成请求体字节，boundary 同时写进请求头，
// 不依赖运行时对 FormData 的序列化
function buildMultipartBody(
  boundary: string,
  fileName: string,
  mimeType: string,
  fileData: Buffer,
): Buffer {
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([head, fileData, tail]);
}
