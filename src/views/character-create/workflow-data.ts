import chineseInkImage from '@/assets/character-styles/chinese-ink-male.png';
import chibiKawaiiImage from '@/assets/character-styles/chibi-kawaii-male.png';
import cinematicNoirImage from '@/assets/character-styles/cinematic-noir-male.png';
import flatEditorialImage from '@/assets/character-styles/flat-editorial-male.png';
import ghibliGouacheImage from '@/assets/character-styles/ghibli-gouache-male.png';
import lineRisoImage from '@/assets/character-styles/line-riso-male.png';
import mappaCelImage from '@/assets/character-styles/mappa-cel-male.png';
import neonSynthImage from '@/assets/character-styles/neon-synth-male.png';
import paperDioramaImage from '@/assets/character-styles/paper-diorama-male.png';
import type { CharacterCreateDraft } from '@/types';

export type Step = 1 | 2 | 3 | 4;
export type StyleId =
  | 'line-riso'
  | 'paper-diorama'
  | 'flat-editorial'
  | 'chibi-kawaii'
  | 'mappa-cel'
  | 'ghibli-gouache'
  | 'chinese-ink'
  | 'cinematic-noir'
  | 'neon-synth';

export type CharacterPromptDraft = CharacterCreateDraft;
export const CORE_DRAFT_FIELDS = [
  'gender',
  'age',
  'hairstyle',
  'hairColor',
  'clothingStyle',
  'bottomsStyle',
  'characterMood',
  'primaryColor',
  'overallStyleKeywords',
] as const;
export type CoreDraftField = (typeof CORE_DRAFT_FIELDS)[number];

export interface CharacterDraftPreset {
  color?: string;
  label: string;
  value: string;
}

export const CHARACTER_DRAFT_PRESETS: Record<
  Exclude<CoreDraftField, 'overallStyleKeywords'>,
  CharacterDraftPreset[]
> = {
  gender: [
    { label: '女性', value: 'female woman' },
    { label: '男性', value: 'male man' },
    { label: '中性', value: 'androgynous person' },
  ],
  age: [
    { label: '儿童', value: 'child' },
    { label: '少年', value: 'teenager' },
    { label: '青年', value: 'young adult' },
    { label: '成熟', value: 'adult' },
  ],
  hairstyle: [
    { label: '短发', value: 'short hair' },
    { label: '长发', value: 'long hair' },
    { label: '马尾', value: 'ponytail' },
    { label: '卷发', value: 'curly hair' },
    { label: '齐刘海', value: 'straight bangs' },
  ],
  hairColor: [
    { color: '#262626', label: '黑色', value: 'black' },
    { color: '#704128', label: '棕色', value: 'brown' },
    { color: '#d5a23d', label: '金色', value: 'blonde' },
    { color: '#ae4b59', label: '红色', value: 'red' },
    { color: '#526c9e', label: '蓝色', value: 'blue' },
  ],
  clothingStyle: [
    { label: '休闲', value: 'casual' },
    { label: '通勤', value: 'smart casual' },
    { label: '学院', value: 'preppy' },
    { label: '运动', value: 'sportswear' },
    { label: '传统', value: 'traditional inspired' },
  ],
  bottomsStyle: [
    { label: '长裤', value: 'straight trousers' },
    { label: '短裤', value: 'shorts' },
    { label: '半身裙', value: 'midi skirt' },
    { label: '长裙', value: 'long skirt' },
    { label: '背带裤', value: 'overalls' },
  ],
  characterMood: [
    { label: '亲和', value: 'friendly and warm' },
    { label: '沉稳', value: 'calm and composed' },
    { label: '元气', value: 'energetic and optimistic' },
    { label: '酷感', value: 'confident and cool' },
    { label: '文静', value: 'gentle and reserved' },
  ],
  primaryColor: [
    { color: '#e15d4a', label: '珊瑚红', value: 'coral red' },
    { color: '#e5ac3f', label: '琥珀黄', value: 'amber yellow' },
    { color: '#468b65', label: '森林绿', value: 'forest green' },
    { color: '#4b76b8', label: '海军蓝', value: 'navy blue' },
    { color: '#8e609f', label: '葡萄紫', value: 'grape purple' },
  ],
};

export function createEmptyCharacterPromptDraft(): CharacterPromptDraft {
  return {
    age: '',
    gender: '',
    hairColor: '',
    hairstyle: '',
    clothingColor: '',
    clothingStyle: '',
    clothingLength: '',
    bottomsColor: '',
    bottomsStyle: '',
    bottomsLength: '',
    shoesColor: '',
    shoesStyle: '',
    shoesHeight: '',
    accessories: '',
    props: '',
    characterMood: '',
    primaryColor: '',
    secondaryColor: '',
    accentColor: '',
    backgroundColor: '',
    forbiddenColors: '',
    overallStyleKeywords: '',
  };
}

export interface CharacterStyleOption {
  id: StyleId;
  name: string;
  subtitle: string;
  description: string;
  image: string;
  tags: string[];
  stylePrompt: string;
}

export const CHARACTER_WORKFLOW_STEPS = [
  {
    number: 1,
    label: '选择风格',
    description: '喜欢某个方向就选作起点；暂时不确定也可以跳过，后面通过对话再决定。',
  },
  {
    number: 2,
    label: '提供素材',
    description: '上传一张照片作为 AI 生图参考；没有合适的参考图也可以直接跳过。',
  },
  {
    number: 3,
    label: '选择形象',
    description: '点选核心方向，一次生成四张候选整图，再选出最接近的一张。',
  },
  {
    number: 4,
    label: '精修定稿',
    description: '用选中的候选图进行 2k 精修，确认后保存为角色正式视觉。',
  },
] as const;

export const CHARACTER_STYLES: CharacterStyleOption[] = [
  {
    id: 'line-riso',
    name: '单线轮廓',
    subtitle: '瑞士网格 + Risograph',
    description: '稳定线宽 + 大面积留白，适合知识库与产品内容。',
    image: lineRisoImage,
    tags: ['黑白', '留白', '单线'],
    stylePrompt: `现代极简单线轮廓人物插画，Swiss grid discipline meets friendly risograph 美学。
单色（黑色或主色）contour line，line weight 全图 2pt 一致，无渐变无光影无填色，
matte flat composition。留白充足，人物居中，全身完整。

只表现用户设定的一个单人角色，年龄、性别、发型、服装、配饰和动作完全以人物设定为准，
不自行补充具体外貌或穿着。1:1 方形构图，纯白或接近白色背景，高清。
不要添加人物设定未提及的场景和物件，不要使用渐变、写实光影、纹理或摄影质感，
不要出现多人、文字、Logo 或水印。`,
  },
  {
    id: 'paper-diorama',
    name: '彩铅童书',
    subtitle: '中世纪纸雕绘本',
    description: '可见的彩铅笔触、不均匀填色与纸面手作感。',
    image: paperDioramaImage,
    tags: ['彩铅', '童趣', '纸面感'],
    stylePrompt: `童书中世纪纸雕插画风格，mid-century children's book illustration with layered paper diorama 质感。
轮廓和填色都要有真实彩色铅笔或蜡笔手绘感：线条轻微抖动、重复、不完全闭合；
填色保留清楚笔触、深浅变化、少量露白和轻微越界。整体必须有纸面手作感和绘本气质，
不能像电脑绘制的平滑矢量图。

只表现用户设定的一个单人角色，年龄、性别、发型、服装、配饰和动作完全以人物设定为准。
1:1 方形构图，纯白或浅色背景，保留大量留白，人物居中，全身完整可见，高清。
不要添加人物设定未提及的场景和物件，不要使用渐变、写实光影、摄影、3D、多人、文字、Logo 或水印。`,
  },
  {
    id: 'flat-editorial',
    name: '平面撞色',
    subtitle: '现代产品插画',
    description: '深色粗轮廓搭配 muted sage / dusty rose / sand 色块。',
    image: flatEditorialImage,
    tags: ['撞色', '几何', '产品感'],
    stylePrompt: `现代互联网产品平面撞色人物插画，Behance 2024 flat illustration 美学。
清晰有力、粗细稳定的深色轮廓线 + 高纯度纯色平涂，无渐变无写实光影无立体体积。
palette：muted sage / dusty rose / sand / 暖中性色。strong silhouette + geometric curves。

只表现用户设定的一个单人角色，年龄、性别、发型、服装、配饰和动作完全以人物设定为准。
1:1 方形构图，纯白背景，保留充足留白，人物居中，全身完整可见，高清。
颜色优先使用人物设定和配色字段；如果用户没有指定颜色，才使用 muted sage + dusty rose + sand 默认撞色组合。
不要添加人物设定未提及的场景和物件，不要使用渐变、写实光影、纹理、摄影质感、3D、多人、文字、Logo 或水印。`,
  },
  {
    id: 'chibi-kawaii',
    name: '软萌 Q 版',
    subtitle: '圆润简笔 IP',
    description: '大头短肢 + 圆角造型 + 柔和马卡龙色，亲和易记。',
    image: chibiKawaiiImage,
    tags: ['Q版', '马卡龙', 'IP感'],
    stylePrompt: `软萌 Q 版人物插画，chibi Q-style with oversized head ratio 美学。
约三头身比例：头部偏大，身体和四肢短小但结构清楚。
圆润、平滑、略粗的轮廓线，所有转角柔和圆滑；造型高度简化，手脚使用小而圆的几何形状。
纯色平涂，无渐变无立体光影。palette：柔和、亲和的低饱和马卡龙色。

只表现用户设定的一个单人角色，年龄、性别、发型、服装、配饰和动作完全以人物设定为准。
1:1 方形构图，纯白背景，保留充足留白，人物居中，全身完整可见，高清。
颜色优先使用人物设定和配色字段；如果用户没有指定颜色，才使用柔和马卡龙配色。
不要添加人物设定未提及的场景和物件，不要使用写实、摄影、3D、多人、文字、Logo 或水印。`,
  },
  {
    id: 'mappa-cel',
    name: '动漫赛璐璐',
    subtitle: 'MAPPA 风格 2D',
    description: '重彩赛璐璐上色 + 锐利线稿 + rim light。',
    image: mappaCelImage,
    tags: ['动漫', '赛璐璐', 'rim light'],
    stylePrompt: `现代日本动漫人物插画，MAPPA-style digital 2D animation 美学。
Heavy cel shading + crisp line art + luminous eyes + rim light on figures。
polished modern anime rendering，soft cel shading，subtle fabric texture。
Palette：deep navy + electric cyan + crimson splashes 风格的高对比动漫色调。

只表现用户设定的一个单人角色，年龄、性别、发型、服装、配饰和动作完全以人物设定为准。
1:1 方形构图，纯白或简洁背景，人物居中，全身完整可见，高清。
颜色优先使用人物设定和配色字段；如果用户没有指定颜色，才使用 deep navy + cyan + crimson 默认组合。
不要添加人物设定未提及的场景和物件，不要使用写实摄影、3D、多人、文字、Logo 或水印。`,
  },
  {
    id: 'ghibli-gouache',
    name: 'Ghibli 水彩',
    subtitle: '宫崎骏 gouache',
    description: '柔和水彩 wash + 自然光 + 梦幻漂浮感。',
    image: ghibliGouacheImage,
    tags: ['Ghibli', '水彩', '治愈'],
    stylePrompt: `吉卜力风格水彩 gouache 人物插画，Hayao Miyazaki dreamlike gouache 美学。
Soft watercolor wash，gentle natural light，dreamlike floating quality。
Palette：cerulean + spring green + blossom pink + warm cream 的柔和自然色。
Cell shading 极轻，主要靠 watercolor wash 表现体积。

只表现用户设定的一个单人角色，年龄、性别、发型、服装、配饰和动作完全以人物设定为准。
1:1 方形构图，简洁背景或轻微远景氛围，人物居中，全身完整可见，高清。
颜色优先使用人物设定和配色字段；如果用户没有指定颜色，才使用 cerulean + spring green + blossom pink 默认组合。
不要添加人物设定未提及的场景和物件，不要使用写实摄影、3D、厚重写实光影、多人、文字、Logo 或水印。`,
  },
  {
    id: 'chinese-ink',
    name: '新中式水墨',
    subtitle: '工笔 + 写意',
    description: '工笔线条 + 写意氛围 + 大量留白，克制传统色。',
    image: chineseInkImage,
    tags: ['新中式', '水墨', '留白'],
    stylePrompt: `新中式水墨人物插画，New Chinese visual style with light-luxury and restrained 美学。
gongbi 级工笔线条 + 写意水墨氛围结合。留白 negative space 充足。
Palette：墨黑 + 赭石 + 朱砂 + 米白 的克制传统色，偶用青绿点缀。

只表现用户设定的一个单人角色，年龄、性别、发型、服装、配饰和动作完全以人物设定为准。
1:1 方形构图，大量留白，米白或宣纸色背景，人物居中，全身完整可见，高清。
颜色优先使用人物设定和配色字段；如果用户没有指定颜色，才使用墨黑 + 赭石 + 朱砂 + 米白 默认组合。
不要添加人物设定未提及的场景和物件，不要使用写实摄影、3D、霓虹色调、卡通 Q 版、多人、文字、Logo 或水印。`,
  },
  {
    id: 'cinematic-noir',
    name: '写实电影',
    subtitle: 'BR2049 duo-tone',
    description: '35mm 变形宽银幕 + orange-teal + 硬阴影 + 浅景深。',
    image: cinematicNoirImage,
    tags: ['电影', '写实', 'duo-tone'],
    stylePrompt: `电影级写实人物肖像，Blade Runner 2049 anamorphic 35mm cinematography 美学。
Orange-teal duo-tone 调色，venetian-blind shadows 硬阴影，cinematic portrait framing。
Eye-level 半身或全身肖像构图，shallow depth of field 浅景深，bokeh 背景虚化。
皮肤纹理真实，有毛孔、皱纹、布料磨损等细节；避免过度抛光和摆拍感。

只表现用户设定的一个单人角色，年龄、性别、发型、服装、配饰和动作完全以人物设定为准。
1:1 方形构图，电影感打光，背景暗调或强烈虚化，人物居中偏前，高清。
颜色优先使用人物设定和配色字段；如果用户没有指定颜色，才使用 warm orange + cold teal 默认 duo-tone。
不要添加人物设定未提及的场景和物件，不要使用 3D、卡通、动漫、Q 版、二次元、多人、文字、Logo 或水印。`,
  },
  {
    id: 'neon-synth',
    name: '霓虹赛博',
    subtitle: 'Synthwave + 90s 赛博朋克',
    description: '霓虹灯光 + 雨夜湿反射 + magenta/cyan 高对比。',
    image: neonSynthImage,
    tags: ['赛博朋克', '霓虹', '90s 动漫'],
    stylePrompt: `90 年代赛博朋克动漫风格人物插画，synthwave neon retro-cyberpunk 美学。
霓虹灯光 + 雨夜湿反射 + 城市招牌光晕。Magenta + cyan + electric purple 高对比色调。
Heavy cel shading + crisp line art + 略带 90s anime 的五官比例（luminous eyes, sharp jaw）。
可以添加小量未来装饰（cybernetic accessory / glowing trim），但不重新设计角色服装与身份。

只表现用户设定的一个单人角色，年龄、性别、发型、服装、配饰和动作完全以人物设定为准。
1:1 方形构图，雨夜街道或霓虹招牌背景，人物居中，全身完整可见，高清。
颜色优先使用人物设定和配色字段；如果用户没有指定颜色，才使用 magenta + cyan + electric purple 默认组合。
不要添加场景中其他人物，不要使用 3D、写实摄影、Q 版、儿童向、多人、文字、Logo 或水印。`,
  },
];
