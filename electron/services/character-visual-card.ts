import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createDeepSeek } from '@ai-sdk/deepseek';
import type { DeepSeekLanguageModelChatOptions } from '@ai-sdk/deepseek';
import { generateText } from 'ai';
import { z } from 'zod';
import type { ArtStyle } from '../../shared/art-style';
import type { CharacterDraft } from '../../shared/character';
import { CHARACTER_DRAFT_FIELDS, DEFAULT_DEEPSEEK_MODEL } from '../../shared/character';
import type {
  CharacterPortraitImage,
  CharacterPortraitTaskStatus,
} from '../../shared/character-portrait';
import type {
  CharacterVisualCard,
  CharacterVisualCardDraw,
  CharacterVisualCardWorkspaceState,
  GenerateCharacterVisualCardsRequest,
  GetCharacterVisualCardTaskRequest,
} from '../../shared/character-visual-card';
import { CHARACTER_VISUAL_CARD_COUNT } from '../../shared/character-visual-card';
import { getArtStyle, readArtStyleReference } from './art-style';
import { getActiveCharacterDirectory } from './character-library';
import { loadCharacterDraft } from './character-workspace';
import { getCredentialValue } from './credentials';
import { readJsonFile, writeJsonFile } from './json-store';
import { getWorkspaceDirectory } from './workspace';

const API_BASE_URL = 'https://api.apimart.ai';
const STORE_FILE_NAME = 'character-visual-cards.json';
const ASSET_DIRECTORY = 'character-visual-cards';
const MAX_DRAWS = 20;
const MAX_GUIDANCE_LENGTH = 2_000;
const DRAW_ID_PATTERN = /^draw_[A-Za-z0-9-]{1,200}$/;
const CARD_ID_PATTERN = /^card_[A-Za-z0-9-]{1,200}$/;
const TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

interface StoredCharacterVisualCardWorkspace {
  draws: CharacterVisualCardDraw[];
  version: 1;
}

interface ApiTaskImage {
  url: string[];
}

interface ApiTaskData {
  error?: { message?: string };
  progress?: number;
  result?: { images?: ApiTaskImage[] };
  status?: string;
}

let storeMutationQueue = Promise.resolve();

const visualHypothesesSchema = z.object({
  cards: z
    .array(
      z.object({
        prompt: z.string().min(80).max(2_000),
        summary: z.string().min(10).max(240),
        tags: z.array(z.string().min(1).max(30)).min(3).max(6),
        title: z.string().min(2).max(30),
      }),
    )
    .length(CHARACTER_VISUAL_CARD_COUNT),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isTaskStatus(value: unknown): value is CharacterPortraitTaskStatus {
  return ['submitted', 'pending', 'processing', 'completed', 'failed', 'cancelled'].includes(
    String(value),
  );
}

function getAssetUrl(fileName: string): string {
  return `app://bundle/workspace-assets/${ASSET_DIRECTORY}/${encodeURIComponent(fileName)}`;
}

function parseImage(value: unknown): CharacterPortraitImage | null {
  if (
    !isRecord(value) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName
  ) {
    return null;
  }
  return {
    fileName: value.fileName,
    mimeType: typeof value.mimeType === 'string' ? value.mimeType : 'image/png',
    name: typeof value.name === 'string' ? value.name : undefined,
    url: getAssetUrl(value.fileName),
  };
}

function parseDraft(value: unknown): CharacterDraft {
  const draft = {} as CharacterDraft;
  for (const field of CHARACTER_DRAFT_FIELDS) {
    draft[field] = isRecord(value) && typeof value[field] === 'string' ? value[field] : '';
  }
  return draft;
}

function parseCard(value: unknown): CharacterVisualCard | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !CARD_ID_PATTERN.test(value.id) ||
    typeof value.title !== 'string' ||
    typeof value.summary !== 'string' ||
    typeof value.prompt !== 'string' ||
    !Array.isArray(value.tags) ||
    !isTaskStatus(value.status) ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null;
  }
  const taskId =
    typeof value.taskId === 'string' && TASK_ID_PATTERN.test(value.taskId) ? value.taskId : null;
  return {
    createdAt: value.createdAt,
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    id: value.id,
    image: parseImage(value.image),
    progress: typeof value.progress === 'number' ? Math.min(100, Math.max(0, value.progress)) : 0,
    prompt: value.prompt.slice(0, 2_000),
    status: value.status,
    summary: value.summary.slice(0, 240),
    tags: value.tags
      .filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim()))
      .slice(0, 6),
    taskId,
    title: value.title.slice(0, 30),
    updatedAt: value.updatedAt,
  };
}

function parseDraw(value: unknown): CharacterVisualCardDraw | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !DRAW_ID_PATTERN.test(value.id) ||
    !isRecord(value.artStyle) ||
    typeof value.artStyle.id !== 'string' ||
    typeof value.artStyle.name !== 'string' ||
    !Array.isArray(value.cards) ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null;
  }
  const cards = value.cards
    .map(parseCard)
    .filter((card): card is CharacterVisualCard => Boolean(card));
  if (!cards.length) {
    return null;
  }
  return {
    artStyle: { id: value.artStyle.id, name: value.artStyle.name },
    cards,
    createdAt: value.createdAt,
    draftSnapshot: parseDraft(value.draftSnapshot),
    guidance: typeof value.guidance === 'string' ? value.guidance : null,
    id: value.id,
    updatedAt: value.updatedAt,
  };
}

async function getStorePath(): Promise<string> {
  return path.join(await getActiveCharacterDirectory(), STORE_FILE_NAME);
}

async function loadStore(storePath: string): Promise<StoredCharacterVisualCardWorkspace> {
  const value = await readJsonFile(storePath);
  const draws =
    isRecord(value) && Array.isArray(value.draws)
      ? value.draws
          .map(parseDraw)
          .filter((draw): draw is CharacterVisualCardDraw => Boolean(draw))
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, MAX_DRAWS)
      : [];
  return { draws, version: 1 };
}

async function saveStore(
  storePath: string,
  store: StoredCharacterVisualCardWorkspace,
): Promise<void> {
  await writeJsonFile(storePath, {
    ...store,
    draws: store.draws.slice(0, MAX_DRAWS),
  });
}

function persistDraw(
  storePath: string,
  draw: CharacterVisualCardDraw,
): Promise<CharacterVisualCardDraw> {
  const operation = storeMutationQueue.then(async () => {
    const store = await loadStore(storePath);
    await saveStore(storePath, replaceDraw(store, draw));
    return draw;
  });
  storeMutationQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

function persistCardUpdate(
  storePath: string,
  request: GetCharacterVisualCardTaskRequest,
  updatedCard: CharacterVisualCard,
): Promise<CharacterVisualCardDraw> {
  const operation = storeMutationQueue.then(async () => {
    const store = await loadStore(storePath);
    const draw = store.draws.find(item => item.id === request.drawId);
    if (!draw?.cards.some(item => item.id === request.cardId)) {
      throw new Error('未找到视觉卡任务');
    }
    const updatedDraw: CharacterVisualCardDraw = {
      ...draw,
      cards: draw.cards.map(item => (item.id === request.cardId ? updatedCard : item)),
      updatedAt: updatedCard.updatedAt,
    };
    await saveStore(storePath, replaceDraw(store, updatedDraw));
    return updatedDraw;
  });
  storeMutationQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

function resolveDeepSeekModel(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('DeepSeek 模型无效');
  }
  const model = value.trim();
  if (!model || model === 'deepseek-chat' || model === 'deepseek-reasoner') {
    return DEFAULT_DEEPSEEK_MODEL;
  }
  if (model.length > 200 || !/^[a-zA-Z0-9._-]+$/.test(model)) {
    throw new Error('DeepSeek 模型无效');
  }
  return model;
}

function parseHypothesesResponse(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('DeepSeek 未返回有效的视觉简报');
  }
  try {
    return visualHypothesesSchema.parse(JSON.parse(trimmed.slice(firstBrace, lastBrace + 1))).cards;
  } catch {
    throw new Error('DeepSeek 返回的视觉简报格式无效');
  }
}

async function generateVisualHypotheses(
  draft: CharacterDraft,
  request: GenerateCharacterVisualCardsRequest,
) {
  const apiKey = await getCredentialValue('deepseek');
  const deepSeek = createDeepSeek({ apiKey });
  const guidance = request.guidance?.trim();
  const { text } = await generateText({
    maxOutputTokens: 2_400,
    model: deepSeek(resolveDeepSeekModel(request.model)),
    prompt: `角色叙事草稿：\n${JSON.stringify(draft, null, 2)}${
      guidance ? `\n\n本轮用户反馈：\n${guidance}` : ''
    }`,
    providerOptions: {
      deepseek: {
        thinking: { type: 'disabled' },
      } satisfies DeepSeekLanguageModelChatOptions,
    },
    system: `你是角色视觉概念设计师。输入是一份叙事角色草稿，不是外观规格书。请生成 3 个差异明确、可以被图片模型直接执行的视觉假设。

工作边界：
1. 不要把“核心概念、性格、动机、经历、关系、说话方式”等原文直接复制到图片提示词。
2. 只把叙事信息转译成可观察的脸部状态、发型、轮廓、体态、姿态、基础造型、道具和整体气质。
3. 未确认的年龄、性别表达、族裔和外貌不能冒充角色事实；它们可以作为本轮可撤回的视觉假设，并让三张卡有意识地形成差异。
4. 三个方案必须在人物轮廓或视觉重心上明显不同，不能只换颜色。
5. prompt 使用简短分段，依次写：主体、可见特征、姿态与视线、构图、禁止项。只写画面中能看见的内容。
6. 每个 summary 用一句中文解释这张卡选择了什么视觉方向；tags 只放 3 到 6 个具体可见标签。
7. 不写画风，画风会由系统另外附加。
8. 只输出 JSON，不要 Markdown、解释或代码围栏。

JSON 结构：
{"cards":[{"title":"方案名","summary":"一句话视觉假设","tags":["标签"],"prompt":"可直接生图的中文提示词"}]}`,
  });
  return parseHypothesesResponse(text);
}

function validateGenerateRequest(request: GenerateCharacterVisualCardsRequest): void {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.artStyleId !== 'string' ||
    !request.artStyleId.trim() ||
    typeof request.model !== 'string' ||
    (request.guidance !== undefined &&
      (typeof request.guidance !== 'string' || request.guidance.length > MAX_GUIDANCE_LENGTH))
  ) {
    throw new Error('视觉抽卡参数无效');
  }
}

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
    return payload.error.message;
  }
  return fallback;
}

async function requestApi(url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
  } catch (error: unknown) {
    throw new Error(
      error instanceof Error ? `无法连接图片生成服务：${error.message}` : '无法连接图片生成服务',
    );
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`图片生成服务返回了无法解析的响应（HTTP ${response.status}）`);
  }
  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, `图片生成服务请求失败（HTTP ${response.status}）`));
  }
  return payload;
}

function getSubmittedTaskId(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error('图片生成服务未返回任务编号');
  }
  const firstItem = payload.data[0];
  if (!isRecord(firstItem) || typeof firstItem.task_id !== 'string') {
    throw new Error('图片生成服务未返回任务编号');
  }
  if (!TASK_ID_PATTERN.test(firstItem.task_id)) {
    throw new Error('图片生成服务返回了无效的任务编号');
  }
  return firstItem.task_id;
}

function parseTaskData(payload: unknown): ApiTaskData {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error('图片生成服务返回了无效的任务状态');
  }
  const data = payload.data;
  const error = isRecord(data.error)
    ? { message: typeof data.error.message === 'string' ? data.error.message : undefined }
    : undefined;
  const resultImages =
    isRecord(data.result) && Array.isArray(data.result.images)
      ? data.result.images.filter(isRecord).map(image => ({
          url: Array.isArray(image.url)
            ? image.url.filter((url): url is string => typeof url === 'string')
            : [],
        }))
      : undefined;
  return {
    error,
    progress: typeof data.progress === 'number' ? data.progress : undefined,
    result: resultImages ? { images: resultImages } : undefined,
    status: typeof data.status === 'string' ? data.status : undefined,
  };
}

function getImageExtension(mimeType: string, imageUrl: string): string {
  const extensions: Record<string, string> = {
    'image/avif': '.avif',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const normalizedMimeType = mimeType.split(';', 1)[0]?.trim().toLowerCase();
  if (normalizedMimeType && extensions[normalizedMimeType]) {
    return extensions[normalizedMimeType];
  }
  const extension = path.extname(new URL(imageUrl).pathname).toLowerCase();
  return ['.avif', '.jpeg', '.jpg', '.png', '.webp'].includes(extension) ? extension : '.png';
}

async function downloadTaskImage(
  taskId: string,
  taskData: ApiTaskData,
): Promise<CharacterPortraitImage> {
  const imageUrl = taskData.result?.images?.flatMap(image => image.url)[0];
  if (!imageUrl) {
    throw new Error('视觉卡生成任务已完成，但没有返回图片');
  }
  const parsedImageUrl = new URL(imageUrl);
  if (parsedImageUrl.protocol !== 'https:') {
    throw new Error('图片生成服务返回了不安全的图片地址');
  }
  const response = await fetch(parsedImageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new Error(`视觉卡保存失败（HTTP ${response.status}）`);
  }
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > 50 * 1024 * 1024) {
    throw new Error('生成图片超过 50 MB，无法保存');
  }
  const mimeType = response.headers.get('content-type')?.split(';', 1)[0] || 'image/png';
  if (!mimeType.startsWith('image/')) {
    throw new Error('图片生成服务返回了无效的图片内容');
  }
  const fileData = new Uint8Array(await response.arrayBuffer());
  if (fileData.byteLength > 50 * 1024 * 1024) {
    throw new Error('生成图片超过 50 MB，无法保存');
  }
  const fileName = `${taskId}${getImageExtension(mimeType, imageUrl)}`;
  const assetDirectory = path.join(await getWorkspaceDirectory(), 'assets', ASSET_DIRECTORY);
  await mkdir(assetDirectory, { recursive: true });
  await writeFile(path.join(assetDirectory, fileName), fileData);
  return { fileName, mimeType, url: getAssetUrl(fileName) };
}

function buildImagePrompt(hypothesis: { prompt: string }, artStyle: ArtStyle): string {
  return [
    '用途：原创角色视觉探索卡，用于讨论角色外形方向，不是最终设定。',
    '背景：干净、克制的浅色背景，不添加叙事场景。',
    hypothesis.prompt.trim(),
    '人物完整入镜，头部到鞋底可见；采用符合这一视觉假设的自然站姿或轻动作，不使用僵硬证件照姿势。单一角色，主体清楚，比例自然。',
    `画风：${artStyle.name}`,
    artStyle.prompt,
    '禁止：文字、标签、Logo、水印、多人、多视角拼贴、设定表排版、裁切脚部、额外肢体。',
  ].join('\n');
}

async function submitCard(
  hypothesis: { prompt: string; summary: string; tags: string[]; title: string },
  artStyle: ArtStyle,
  apiKey: string,
  styleReferenceData: string | null,
  now: string,
): Promise<CharacterVisualCard> {
  const cardId = `card_${randomUUID()}`;
  const prompt = buildImagePrompt(hypothesis, artStyle);
  try {
    const body: Record<string, unknown> = {
      model: 'gpt-image-2',
      n: 1,
      prompt,
      resolution: '1k',
      size: '2:3',
    };
    if (styleReferenceData) {
      body.image_urls = [styleReferenceData];
    }
    const payload = await requestApi(`${API_BASE_URL}/v1/images/generations`, {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    return {
      ...hypothesis,
      createdAt: now,
      errorMessage: null,
      id: cardId,
      image: null,
      progress: 0,
      prompt,
      status: 'submitted',
      taskId: getSubmittedTaskId(payload),
      updatedAt: now,
    };
  } catch (error: unknown) {
    return {
      ...hypothesis,
      createdAt: now,
      errorMessage: error instanceof Error ? error.message : String(error),
      id: cardId,
      image: null,
      progress: 0,
      prompt,
      status: 'failed',
      taskId: null,
      updatedAt: now,
    };
  }
}

function replaceDraw(
  store: StoredCharacterVisualCardWorkspace,
  draw: CharacterVisualCardDraw,
): StoredCharacterVisualCardWorkspace {
  return {
    ...store,
    draws: [draw, ...store.draws.filter(item => item.id !== draw.id)].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    ),
  };
}

export async function getCharacterVisualCardWorkspace(): Promise<CharacterVisualCardWorkspaceState> {
  const store = await loadStore(await getStorePath());
  return { draws: store.draws };
}

export async function generateCharacterVisualCards(
  request: GenerateCharacterVisualCardsRequest,
): Promise<CharacterVisualCardDraw> {
  validateGenerateRequest(request);
  const storePath = await getStorePath();
  const artStyle = await getArtStyle(request.artStyleId);
  if (!artStyle) {
    throw new Error('请选择有效的画风');
  }
  const draft = await loadCharacterDraft();
  if (!CHARACTER_DRAFT_FIELDS.some(field => draft[field].trim())) {
    throw new Error('先聊出一点角色信息，再开始视觉抽卡');
  }
  const hypotheses = await generateVisualHypotheses(draft, request);
  const [apiKey, styleReferenceData] = await Promise.all([
    getCredentialValue('apimart'),
    readArtStyleReference(artStyle),
  ]);
  const now = new Date().toISOString();
  const cards = await Promise.all(
    hypotheses.map(hypothesis => submitCard(hypothesis, artStyle, apiKey, styleReferenceData, now)),
  );
  const draw: CharacterVisualCardDraw = {
    artStyle: { id: artStyle.id, name: artStyle.name },
    cards,
    createdAt: now,
    draftSnapshot: draft,
    guidance: request.guidance?.trim() || null,
    id: `draw_${randomUUID()}`,
    updatedAt: now,
  };
  return persistDraw(storePath, draw);
}

export async function getCharacterVisualCardTask(
  request: GetCharacterVisualCardTaskRequest,
): Promise<CharacterVisualCardDraw> {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.drawId !== 'string' ||
    !DRAW_ID_PATTERN.test(request.drawId) ||
    typeof request.cardId !== 'string' ||
    !CARD_ID_PATTERN.test(request.cardId)
  ) {
    throw new Error('视觉卡任务参数无效');
  }
  const storePath = await getStorePath();
  const store = await loadStore(storePath);
  const draw = store.draws.find(item => item.id === request.drawId);
  const card = draw?.cards.find(item => item.id === request.cardId);
  if (!draw || !card) {
    throw new Error('未找到视觉卡任务');
  }
  if (card.status === 'completed' && card.image) {
    return draw;
  }
  if (!card.taskId || !TASK_ID_PATTERN.test(card.taskId)) {
    return draw;
  }
  const apiKey = await getCredentialValue('apimart');
  const payload = await requestApi(
    `${API_BASE_URL}/v1/tasks/${encodeURIComponent(card.taskId)}?language=zh`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      method: 'GET',
    },
  );
  const taskData = parseTaskData(payload);
  if (!isTaskStatus(taskData.status)) {
    throw new Error('图片生成服务返回了未知任务状态');
  }
  const updatedAt = new Date().toISOString();
  const updatedCard: CharacterVisualCard = {
    ...card,
    errorMessage:
      taskData.status === 'failed' || taskData.status === 'cancelled'
        ? taskData.error?.message || '视觉卡生成任务未完成'
        : null,
    image:
      taskData.status === 'completed' ? await downloadTaskImage(card.taskId, taskData) : card.image,
    progress:
      taskData.status === 'completed'
        ? 100
        : Math.min(100, Math.max(0, taskData.progress ?? card.progress)),
    status: taskData.status,
    updatedAt,
  };
  return persistCardUpdate(storePath, request, updatedCard);
}
