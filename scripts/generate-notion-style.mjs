import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE_URL = 'https://api.apimart.ai';
const apiKey = process.env.APIMART_API_KEY;

const characterDescription = '20-30 岁的年轻男性，穿着卫衣与长裤。';

const prompt = `现代极简产品人物插画，纯粹克制的单线矢量风格。

只表现用户设定的一个单人角色，全身入镜，人物的年龄、性别、发型、服装、配饰和动作完全以人物设定为准，不自行补充具体外貌或穿着。人物比例简洁自然，可以有轻微的友好感，但不要夸张大头或卡通化变形。

背景保持纯白或接近白色，保留大量留白。使用稳定、连续、圆润的单色轮廓线，线条粗细基本一致，内部细节克制，像现代互联网产品中的角色动作插画。颜色使用黑色描绘线条。
发型使用黑色填充

人物设定：${characterDescription}

1:1 方形构图，人物居中，全身完整可见，高清。不要添加人物设定未提及的场景和物件，不要使用渐变、写实光影、纹理或摄影质感，不要出现多人、文字、Logo 或水印。`;

if (!apiKey) {
  throw new Error('请先设置 APIMART_API_KEY');
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `请求失败：HTTP ${response.status}`);
  }
  return payload;
}

const submitted = await request(`${API_BASE_URL}/v1/images/generations`, {
  method: 'POST',
  body: JSON.stringify({
    model: 'gpt-image-2',
    n: 1,
    prompt,
    resolution: '1k',
    size: '1:1',
  }),
});

const taskId = submitted?.data?.[0]?.task_id;
if (!taskId) {
  throw new Error('接口没有返回任务编号');
}

console.log(`任务已提交：${taskId}`);

let imageUrl = '';
for (let attempt = 1; attempt <= 100; attempt += 1) {
  await new Promise(resolve => setTimeout(resolve, 3000));
  const task = await request(`${API_BASE_URL}/v1/tasks/${encodeURIComponent(taskId)}?language=zh`);
  const { error, result, status } = task.data ?? {};
  console.log(`第${attempt}次尝试，taskId ${taskId}%`);

  if (status === 'completed') {
    imageUrl = result?.images?.flatMap(image => image.url ?? [])?.[0] ?? '';
    break;
  }
  if (status === 'failed' || status === 'cancelled') {
    throw new Error(error?.message || `图片生成${status === 'failed' ? '失败' : '已取消'}`);
  }
}

if (!imageUrl) {
  throw new Error('等待图片生成超时');
}

const imageResponse = await fetch(imageUrl);
if (!imageResponse.ok) {
  throw new Error(`图片下载失败：HTTP ${imageResponse.status}`);
}

const mimeType = imageResponse.headers.get('content-type')?.split(';', 1)[0] ?? 'image/png';
const extension = mimeType === 'image/webp' ? '.webp' : mimeType === 'image/jpeg' ? '.jpg' : '.png';
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.resolve(scriptDirectory, '../src/assets/character-styles');
const outputPath = path.join(outputDirectory, `contrast-line-male${extension}`);

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, new Uint8Array(await imageResponse.arrayBuffer()));

console.log(`图片已保存：${outputPath}`);
