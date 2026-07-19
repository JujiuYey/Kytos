import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ArtStyle,
  ArtStyleWorkspaceState,
  DeleteArtStyleRequest,
  SaveArtStyleRequest,
  SelectArtStyleRequest,
} from '../../shared/art-style';
import { DEFAULT_ART_STYLE_ID } from '../../shared/art-style';
import type { CharacterPortraitImage } from '../../shared/character-portrait';
import { isNodeError, readJsonFile, writeJsonFile } from './json-store';
import { getWorkspaceDirectory } from './workspace';

const STORE_FILE_NAME = 'art-styles.json';
const ASSET_DIRECTORY = 'art-styles';
const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_PROMPT_LENGTH = 20_000;
const MAX_REFERENCE_IMAGE_SIZE = 20 * 1024 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

interface StoredReferenceImage {
  fileName: string;
  mimeType: string;
}

interface StoredCustomArtStyle extends Omit<ArtStyle, 'referenceImage' | 'source'> {
  referenceImage: StoredReferenceImage | null;
  source: 'custom';
}

interface StoredArtStyleWorkspace {
  activeStyleId: string;
  styles: StoredCustomArtStyle[];
  version: 1;
}

const PRESET_STYLES: ArtStyle[] = [
  {
    createdAt: '2026-01-01T00:00:00.000Z',
    description: '纤细黑色手绘线条、大面积留白与少量红色强调，适合角色日常和知识插画。',
    id: DEFAULT_ART_STYLE_ID,
    name: '极简手绘线稿',
    palette: ['#fafafa', '#171717', '#ef3b24', '#a3a3a3'],
    prompt:
      '白底极简手绘线稿插画。使用纤细、自然、略带手绘抖动感的黑色线条，大面积留白，场景元素保持稀疏。整体以黑白灰为主，仅在角色识别色或关键提示上使用少量高饱和强调色。不使用写实光影、厚涂、3D、复杂纹理、彩色背景、漫画分格或装饰边框。',
    referenceImage: null,
    source: 'preset',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    createdAt: '2026-01-01T00:00:00.000Z',
    description: '清晰轮廓、平涂色块与克制阴影，适合稳定产出系列角色插画。',
    id: 'preset-clean-animation',
    name: '清爽动画平涂',
    palette: ['#f8fafc', '#222222', '#3b82f6', '#f97316'],
    prompt:
      '清爽的二维动画平涂风格。轮廓线清晰稳定，使用简洁色块和一至两层克制阴影，人物比例自然，表情有感染力。背景概括但具有空间层次，色彩明快且控制数量。避免厚重笔触、照片质感、复杂材质、强烈噪点和三维渲染感。',
    referenceImage: null,
    source: 'preset',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    createdAt: '2026-01-01T00:00:00.000Z',
    description: '透明水彩叠色与纸张呼吸感，适合安静、温柔和回忆感场景。',
    id: 'preset-soft-watercolor',
    name: '柔和叙事水彩',
    palette: ['#f7f3ea', '#668f80', '#d98f70', '#7393b3'],
    prompt:
      '柔和叙事水彩插画。使用透明水彩叠色、轻微纸张纹理和自然渗化边缘，保留适量未着色区域。光线柔和，色彩低饱和但不灰暗，人物五官与动作保持清楚。避免厚涂油画感、硬边矢量色块、照片写实、过度锐化和高对比霓虹色。',
    referenceImage: null,
    source: 'preset',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    createdAt: '2026-01-01T00:00:00.000Z',
    description: '复古四色印刷、网点与套色偏移，适合轻松、有节奏的故事表达。',
    id: 'preset-retro-print',
    name: '复古四色印刷',
    palette: ['#f4e8c1', '#1d3557', '#e63946', '#e9c46a'],
    prompt:
      '复古四色印刷插画。使用有限色盘、粗细有变化的墨线、细密网点和轻微套色偏移，纸张带温和旧印刷质感。构图明确，人物轮廓易识别，画面有海报式节奏但不添加文字。避免现代霓虹渐变、照片写实、光滑三维材质和过多颜色。',
    referenceImage: null,
    source: 'preset',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    createdAt: '2026-01-01T00:00:00.000Z',
    description: '铅笔结构线、擦痕与纸面颗粒，适合草稿感和内心独白。',
    id: 'preset-pencil-sketch',
    name: '铅笔叙事速写',
    palette: ['#f5f5f4', '#292524', '#78716c', '#b45309'],
    prompt:
      '铅笔叙事速写风格。保留轻重变化的石墨线、结构辅助线、局部排线和自然擦痕，纸面颗粒可见。人物姿态和表情优先清晰，背景以概括线条提示空间，仅使用极少量暖色点缀。避免工整矢量描边、厚重色块、照片写实和三维渲染。',
    referenceImage: null,
    source: 'preset',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    createdAt: '2026-01-01T00:00:00.000Z',
    description: '柔和几何形、纸张层叠与低饱和色块，适合儿童与轻松叙事。',
    id: 'preset-paper-collage',
    name: '纸艺拼贴',
    palette: ['#fff8e7', '#4d908e', '#f9844a', '#577590'],
    prompt:
      '现代纸艺拼贴插画。人物和场景由柔和几何形与手工剪纸边缘组成，使用低饱和色块、轻微纸张纤维和克制的层叠投影。形象简洁但身份特征清楚，构图活泼有秩序。避免照片贴图、复杂纹理、塑料三维感、强烈镜面高光和细碎装饰。',
    referenceImage: null,
    source: 'preset',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    createdAt: '2026-01-01T00:00:00.000Z',
    description: '锐利轮廓、明确明暗分区和高表现力表情，适合动作与情绪场景。',
    id: 'preset-cel-shaded-comic',
    name: '赛璐璐漫画',
    palette: ['#ffffff', '#111827', '#2563eb', '#ef4444'],
    prompt:
      '现代赛璐璐漫画风格。使用锐利稳定的轮廓线、清楚的明暗分区和少量高光，色彩鲜明但控制层级。人物动态有张力，表情和轮廓易读，背景使用简洁透视与速度感元素。避免照片写实、柔焦水彩、厚重材质、复杂渐变和三维塑料感。',
    referenceImage: null,
    source: 'preset',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    createdAt: '2026-01-01T00:00:00.000Z',
    description: '几何构成、平面色块与留白，适合知识表达、产品内容和现代叙事。',
    id: 'preset-editorial-geometric',
    name: '现代编辑插画',
    palette: ['#f8fafc', '#0f172a', '#14b8a6', '#f59e0b'],
    prompt:
      '现代编辑插画风格。使用简洁几何构成、平面色块、明确负空间和克制的视觉隐喻，人物造型概括但身份清楚。色盘有限，构图适合快速扫描并突出核心关系。避免写实纹理、复杂背景、过度装饰、三维渲染和无意义的抽象图形。',
    referenceImage: null,
    source: 'preset',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    createdAt: '2026-01-01T00:00:00.000Z',
    description: '可见笔触、电影光影与丰富色彩层次，适合幻想和戏剧性场景。',
    id: 'preset-cinematic-painterly',
    name: '电影感厚涂',
    palette: ['#111827', '#334155', '#d97706', '#f5d0a9'],
    prompt:
      '电影感数字厚涂插画。保留有方向性的绘画笔触，以体积光、环境反射和冷暖关系塑造人物与场景，焦点区域细节清楚，外围适度概括。画面具有戏剧性但人物身份稳定。避免照片拼贴、光滑三维材质、过度锐化、塑料皮肤和杂乱特效。',
    referenceImage: null,
    source: 'preset',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    createdAt: '2026-01-01T00:00:00.000Z',
    description: '松软蜡笔纹理、温暖色块与稚拙边缘，适合治愈和生活主题。',
    id: 'preset-soft-crayon',
    name: '柔软粉彩蜡笔',
    palette: ['#fff7ed', '#7dd3fc', '#f9a8d4', '#86efac'],
    prompt:
      '柔软粉彩蜡笔插画。使用可见的蜡笔颗粒、松弛不完全闭合的边缘和温暖叠色，造型简单亲切，人物表情自然。背景保留纸面呼吸感并使用少量手绘小元素。避免尖锐矢量线、照片写实、金属材质、强对比光影和精密三维效果。',
    referenceImage: null,
    source: 'preset',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    createdAt: '2026-01-01T00:00:00.000Z',
    description: '受限色盘、清晰像素簇与复古游戏构图，适合轻量叙事和趣味场景。',
    id: 'preset-pixel-art',
    name: '复古像素艺术',
    palette: ['#1f2937', '#38bdf8', '#fbbf24', '#f472b6'],
    prompt:
      '精致复古像素艺术。使用清晰像素簇、受限色盘、阶梯状轮廓和手工抖色，不使用平滑抗锯齿。人物剪影与标志性特征在缩小后仍可识别，场景有游戏画面式层次。避免照片纹理、矢量曲线、模糊渐变、高分辨率笔刷和三维渲染。',
    referenceImage: null,
    source: 'preset',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    createdAt: '2026-01-01T00:00:00.000Z',
    description: '强烈黑白对比、刻痕与粗粝纸感，适合寓言、悬疑和力量感场景。',
    id: 'preset-woodcut',
    name: '黑白木刻版画',
    palette: ['#fafaf9', '#1c1917', '#991b1b', '#a8a29e'],
    prompt:
      '黑白木刻版画风格。使用强烈明暗对比、具有方向性的刻痕、粗粝墨边和纸张压印感，以线条密度表现体积。人物轮廓有力量且五官可辨，只使用极少量暗红强调。避免柔和渐变、照片写实、光滑矢量边缘、彩色厚涂和三维材质。',
    referenceImage: null,
    source: 'preset',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getReferenceUrl(fileName: string): string {
  return `app://bundle/workspace-assets/${ASSET_DIRECTORY}/${encodeURIComponent(fileName)}`;
}

function parseReferenceImage(value: unknown): StoredReferenceImage | null {
  if (
    !isRecord(value) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName ||
    typeof value.mimeType !== 'string' ||
    !value.mimeType.startsWith('image/')
  ) {
    return null;
  }
  return { fileName: value.fileName, mimeType: value.mimeType };
}

function parseCustomStyle(value: unknown): StoredCustomArtStyle | null {
  if (
    !isRecord(value) ||
    value.source !== 'custom' ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > MAX_NAME_LENGTH ||
    typeof value.description !== 'string' ||
    value.description.length > MAX_DESCRIPTION_LENGTH ||
    typeof value.prompt !== 'string' ||
    !value.prompt.trim() ||
    value.prompt.length > MAX_PROMPT_LENGTH
  ) {
    return null;
  }
  return {
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    description: value.description.trim(),
    id: value.id,
    name: value.name.trim(),
    palette: [],
    prompt: value.prompt.trim(),
    referenceImage: parseReferenceImage(value.referenceImage),
    source: 'custom',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}

async function getStorePath(): Promise<string> {
  return path.join(await getWorkspaceDirectory(), STORE_FILE_NAME);
}

async function getAssetDirectory(): Promise<string> {
  const directory = path.join(await getWorkspaceDirectory(), 'assets', ASSET_DIRECTORY);
  await mkdir(directory, { recursive: true });
  return directory;
}

async function loadStore(): Promise<StoredArtStyleWorkspace> {
  const value = await readJsonFile(await getStorePath());
  if (!isRecord(value)) {
    return { activeStyleId: DEFAULT_ART_STYLE_ID, styles: [], version: 1 };
  }
  const styles = Array.isArray(value.styles)
    ? value.styles
        .map(parseCustomStyle)
        .filter((style): style is StoredCustomArtStyle => Boolean(style))
    : [];
  const availableIds = new Set([
    ...PRESET_STYLES.map(style => style.id),
    ...styles.map(style => style.id),
  ]);
  const activeStyleId =
    typeof value.activeStyleId === 'string' && availableIds.has(value.activeStyleId)
      ? value.activeStyleId
      : DEFAULT_ART_STYLE_ID;
  return { activeStyleId, styles, version: 1 };
}

async function saveStore(store: StoredArtStyleWorkspace): Promise<void> {
  await writeJsonFile(await getStorePath(), store);
}

function toArtStyle(style: StoredCustomArtStyle): ArtStyle {
  return {
    ...style,
    referenceImage: style.referenceImage
      ? {
          ...style.referenceImage,
          directory: ASSET_DIRECTORY,
          url: getReferenceUrl(style.referenceImage.fileName),
        }
      : null,
  };
}

function toWorkspace(store: StoredArtStyleWorkspace): ArtStyleWorkspaceState {
  return {
    activeStyleId: store.activeStyleId,
    styles: [
      ...PRESET_STYLES.map(style => ({ ...style, palette: [...style.palette] })),
      ...store.styles.map(toArtStyle),
    ],
  };
}

function validateStyleContent(request: SaveArtStyleRequest): void {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.name !== 'string' ||
    !request.name.trim() ||
    request.name.length > MAX_NAME_LENGTH ||
    typeof request.description !== 'string' ||
    request.description.length > MAX_DESCRIPTION_LENGTH ||
    typeof request.prompt !== 'string' ||
    !request.prompt.trim() ||
    request.prompt.length > MAX_PROMPT_LENGTH
  ) {
    throw new Error('画风内容无效');
  }
}

async function deleteReferenceImage(fileName: string | undefined): Promise<void> {
  if (!fileName) {
    return;
  }
  try {
    await unlink(path.join(await getAssetDirectory(), fileName));
  } catch (error: unknown) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      throw error;
    }
  }
}

function getImageExtension(mimeType: string): string {
  return (
    { 'image/avif': '.avif', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[
      mimeType
    ] || '.png'
  );
}

async function saveReferenceImage(
  styleId: string,
  image: NonNullable<SaveArtStyleRequest['referenceImage']>,
): Promise<StoredReferenceImage> {
  if (
    typeof image.fileName !== 'string' ||
    typeof image.mimeType !== 'string' ||
    !image.mimeType.startsWith('image/') ||
    !(image.fileData instanceof Uint8Array) ||
    image.fileData.byteLength < 1 ||
    image.fileData.byteLength > MAX_REFERENCE_IMAGE_SIZE
  ) {
    throw new Error('画风参考图无效或超过 20 MB');
  }
  const fileName = `${styleId}-${randomUUID()}${getImageExtension(image.mimeType)}`;
  await writeFile(path.join(await getAssetDirectory(), fileName), image.fileData);
  return { fileName, mimeType: image.mimeType };
}

export async function getArtStyleWorkspace(): Promise<ArtStyleWorkspaceState> {
  return toWorkspace(await loadStore());
}

export async function getActiveArtStyle(): Promise<ArtStyle> {
  const workspace = await getArtStyleWorkspace();
  return (
    workspace.styles.find(style => style.id === workspace.activeStyleId) ?? workspace.styles[0]!
  );
}

export async function saveArtStyle(request: SaveArtStyleRequest): Promise<ArtStyleWorkspaceState> {
  validateStyleContent(request);
  const store = await loadStore();
  const existing = request.id ? store.styles.find(style => style.id === request.id) : null;
  if (request.id && !existing) {
    throw new Error('只能编辑自定义画风');
  }
  const id = existing?.id ?? randomUUID();
  const now = new Date().toISOString();
  let referenceImage = existing?.referenceImage ?? null;
  const previousFileName = referenceImage?.fileName;
  let newFileName: string | undefined;
  if (request.referenceImage === null) {
    referenceImage = null;
  } else if (request.referenceImage) {
    referenceImage = await saveReferenceImage(id, request.referenceImage);
    newFileName = referenceImage.fileName;
  }
  const style: StoredCustomArtStyle = {
    createdAt: existing?.createdAt ?? now,
    description: request.description.trim(),
    id,
    name: request.name.trim(),
    palette: [],
    prompt: request.prompt.trim(),
    referenceImage,
    source: 'custom',
    updatedAt: now,
  };
  const nextStore = {
    ...store,
    styles: [style, ...store.styles.filter(item => item.id !== id)],
  };
  try {
    await saveStore(nextStore);
  } catch (error: unknown) {
    await deleteReferenceImage(newFileName).catch(() => undefined);
    throw error;
  }
  if (previousFileName !== referenceImage?.fileName) {
    await deleteReferenceImage(previousFileName).catch(() => undefined);
  }
  return toWorkspace(nextStore);
}

export async function selectArtStyle(
  request: SelectArtStyleRequest,
): Promise<ArtStyleWorkspaceState> {
  if (!request || typeof request.id !== 'string' || !ID_PATTERN.test(request.id)) {
    throw new Error('画风选择无效');
  }
  const store = await loadStore();
  const availableIds = new Set([
    ...PRESET_STYLES.map(style => style.id),
    ...store.styles.map(style => style.id),
  ]);
  if (!availableIds.has(request.id)) {
    throw new Error('未找到这个画风');
  }
  const nextStore = { ...store, activeStyleId: request.id };
  await saveStore(nextStore);
  return toWorkspace(nextStore);
}

export async function deleteArtStyle(
  request: DeleteArtStyleRequest,
): Promise<ArtStyleWorkspaceState> {
  if (!request || typeof request.id !== 'string') {
    throw new Error('画风编号无效');
  }
  const store = await loadStore();
  const target = store.styles.find(style => style.id === request.id);
  if (!target) {
    throw new Error('预置画风不能删除');
  }
  const nextStore = {
    ...store,
    activeStyleId: store.activeStyleId === target.id ? DEFAULT_ART_STYLE_ID : store.activeStyleId,
    styles: store.styles.filter(style => style.id !== target.id),
  };
  await saveStore(nextStore);
  await deleteReferenceImage(target.referenceImage?.fileName).catch(() => undefined);
  return toWorkspace(nextStore);
}

export async function importArtStyleReference(options: {
  image: CharacterPortraitImage;
  name: string;
  sourcePath: string;
}): Promise<ArtStyleWorkspaceState> {
  const fileData = new Uint8Array(await readFile(options.sourcePath));
  const workspace = await saveArtStyle({
    description: '从插画资产导入的画风参考。',
    name: options.name,
    prompt:
      '遵循参考图的线条、上色、材质、光影、色彩关系和视觉节奏，不复制参考图中的人物、动作、场景或构图。',
    referenceImage: {
      fileData,
      fileName: options.image.fileName,
      mimeType: options.image.mimeType,
    },
  });
  const imported = workspace.styles.find(
    style => style.source === 'custom' && style.name === options.name,
  );
  return imported ? selectArtStyle({ id: imported.id }) : workspace;
}

export async function readActiveArtStyleReference(style: ArtStyle): Promise<string | null> {
  if (!style.referenceImage) {
    return null;
  }
  const imageData = await readFile(
    path.join(
      await getWorkspaceDirectory(),
      'assets',
      style.referenceImage.directory,
      style.referenceImage.fileName,
    ),
  );
  if (imageData.byteLength > MAX_REFERENCE_IMAGE_SIZE) {
    throw new Error('画风参考图超过 20 MB');
  }
  return `data:${style.referenceImage.mimeType};base64,${imageData.toString('base64')}`;
}
