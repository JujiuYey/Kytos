import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE_URL = 'https://api.apimart.ai';
const apiKey = process.env.APIMART_API_KEY;

const prompt = `现代互联网产品高对比撞色线性人物插画，清晰、活泼，有强烈的产品插画辨识度。

只表现一个用户设定的单人角色，全身入镜。人物比例采用风格化的产品插画语言：头部适度简化，身体轮廓由几何曲线组成，四肢可以略微修长，动作自然且有轻微叙事感。年龄、性别、脸部、发型、服装、配饰和动作完全以用户设定为准，不自行补充具体人物细节。

背景为纯白色，保留大量留白。使用清晰有力、粗细稳定的深色轮廓线和高纯度纯色平涂，形成明确的高对比视觉节奏。颜色优先使用用户明确指定的颜色；如果用户没有指定颜色，才使用深海军蓝、青绿色、亮黄色和钴蓝色作为默认撞色组合。完全不使用渐变、写实光影、纹理或体积光。

整体像现代互联网产品的功能插画和空状态插画，造型大胆、色块清楚、人物动作有叙事感。1:1 方形构图，人物居中，全身完整可见，高清。不要添加用户未提及的场景和物件，不要出现多人、文字、Logo 或水印。

最终优先级：人物设定和配色字段最高；风格要求只负责表现技法。若两者冲突，必须使用人物设定和配色字段，不能用风格默认值覆盖用户明确指定的内容。`;

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
  const { error, progress, result, status } = task.data ?? {};
  console.log(`生成状态：${status ?? 'unknown'} ${progress ?? 0}%`);
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
