import chibiImage from '@/assets/character-styles/chibi-male.png';
import contrastLineImage from '@/assets/character-styles/contrast-line-male.png';
import doodleImage from '@/assets/character-styles/doodle-male.png';
import notionImage from '@/assets/character-styles/notion-male.png';
import qVersionImage from '@/assets/character-styles/q-version-male.png';

export type Step = 1 | 2 | 3 | 4;
export type StyleId = 'notion' | 'doodle' | 'contrast-line' | 'q-version' | 'chibi';

export interface CharacterPromptMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

export interface CharacterPromptDraft {
  age: string;
  gender: string;
  hairColor: string;
  hairstyle: string;
  clothingColor: string;
  clothingStyle: string;
  clothingLength: string;
  bottomsColor: string;
  bottomsStyle: string;
  bottomsLength: string;
  shoesColor: string;
  shoesStyle: string;
  shoesHeight: string;
  accessories: string;
  props: string;
  characterMood: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  forbiddenColors: string;
  overallStyleKeywords: string;
}

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
    label: '参考照片',
    description: '有清晰的人物照片就上传作为参考；没有照片也可以直接进入下一步。',
  },
  {
    number: 3,
    label: '完善形象',
    description: '和助手聊清楚人物细节与画面方向，再整理出最终提示词。',
  },
  {
    number: 4,
    label: '生成图片',
    description: '先生成一张看看，满意就保存，不满意回到任何一步继续调整。',
  },
] as const;

export const CHARACTER_STYLES: CharacterStyleOption[] = [
  {
    id: 'notion',
    name: '单线轮廓',
    subtitle: '黑白极简办公插画',
    description: '干净线稿、纯黑重点、大量留白，适合知识库与产品内容。',
    image: notionImage,
    tags: ['黑白', '留白', '清晰'],
    stylePrompt: `现代极简产品人物插画，纯粹克制的单线矢量风格。

只表现用户设定的一个单人角色，全身入镜，人物的年龄、性别、发型、服装、配饰和动作完全以人物设定为准，不自行补充具体外貌或穿着。人物比例简洁自然，可以有轻微的友好感，但不要夸张大头或卡通化变形。

背景保持纯白或接近白色，保留大量留白。使用稳定、连续、圆润的单色轮廓线，线条粗细基本一致，内部细节克制，像现代互联网产品中的角色动作插画。颜色优先使用人物设定和配色字段；如果用户没有指定颜色，才使用黑白或极少量低饱和中性色作为默认。

1:1 方形构图，人物居中，全身完整可见，高清。不要添加人物设定未提及的场景和物件，不要使用渐变、写实光影、纹理或摄影质感，不要出现多人、文字、Logo 或水印。`,
  },
  {
    id: 'doodle',
    name: '彩铅涂鸦',
    subtitle: '童趣手绘人物',
    description: '可见的彩铅笔触、松散轮廓和不均匀填色，像一张轻松的儿童绘本插画。',
    image: doodleImage,
    tags: ['彩铅', '童趣', '手作感'],
    stylePrompt: `童趣彩铅涂鸦人物插画，像儿童绘本或手绘贴纸中的角色。

只表现用户设定的一个单人角色，全身入镜。人物比例可以天真、简化和略微可爱，但不能变成光滑的数字 Q 版；年龄、性别、发型、服装、配饰和动作完全以人物设定为准。

背景为纯白色，保留大量留白。轮廓和填色都要有真实彩色铅笔或蜡笔手绘质感：线条轻微抖动、重复、不完全闭合；填色保留清楚笔触、深浅变化、少量露白和轻微越界。颜色优先使用人物设定和配色字段；如果用户没有指定颜色，才使用明快但不过度荧光的儿童绘本配色。

整体必须有纸面手作感、童趣和绘本气质，不能像电脑绘制的平滑矢量图。1:1 方形构图，人物居中，全身完整可见，高清。不要添加人物设定未提及的场景和物件，不要使用渐变、写实光影、摄影、3D、多人、文字、Logo 或水印。`,
  },
  {
    id: 'contrast-line',
    name: '撞色线性',
    subtitle: '高对比产品插画',
    description: '深蓝粗轮廓搭配青绿、亮黄和钴蓝色块，人物比例鲜明，产品感强。',
    image: contrastLineImage,
    tags: ['撞色', '粗线条', '产品感'],
    stylePrompt: `现代互联网产品高对比撞色线性人物插画，清晰、活泼，有强烈的产品插画辨识度。

只表现用户设定的一个单人角色，全身入镜。人物比例采用风格化的产品插画语言：头部适度简化，身体轮廓由几何曲线组成，四肢可以略微修长，动作自然且有轻微叙事感；具体人物特征完全以人物设定为准。

背景为纯白色，保留大量留白。使用清晰有力、粗细稳定的深色轮廓线和高纯度纯色平涂，形成明确的高对比视觉节奏。颜色优先使用人物设定和配色字段；如果用户没有指定颜色，才使用深海军蓝、青绿色、亮黄色和钴蓝色作为默认撞色组合。完全不使用渐变、写实光影、纹理或体积光。

整体像现代互联网产品的功能插画和空状态插画，造型大胆、色块清楚、人物动作有叙事感。1:1 方形构图，人物居中，全身完整可见，高清。不要添加人物设定未提及的场景和物件，不要出现多人、文字、Logo 或水印。`,
  },
  {
    id: 'q-version',
    name: '软萌 Q 版',
    subtitle: '圆润的简笔 IP',
    description: '大头短肢、圆角造型和轻快颜色，亲和且容易记住。',
    image: qVersionImage,
    tags: ['圆润', '亲和', 'IP感'],
    stylePrompt: `软萌 Q 版人物插画，圆润可爱的现代简笔 IP 风格。

只表现用户设定的一个单人角色，全身入镜，明确采用约三头身比例：头部偏大，身体和四肢短小，但结构清楚。脸部、发型、服装、配饰和动作完全以人物设定为准，不自行补充固定的性别或外貌。

背景为纯白色，保留充足留白。使用圆润、平滑、略粗的轮廓线，所有转角柔和圆滑；造型高度简化，手脚使用小而圆的几何形状。使用纯色平涂，不使用渐变和立体光影。颜色优先使用人物设定和配色字段；如果用户没有指定颜色，才使用柔和、亲和的低饱和马卡龙配色。

整体像课程角色、贴纸或短视频形象中的软萌 IP，轮廓一眼可辨，亲和、有记忆点。1:1 方形构图，人物居中，全身完整可见，高清。不要添加人物设定未提及的场景和物件，不要使用写实、摄影、3D、多人、文字、Logo 或水印。`,
  },
  {
    id: 'chibi',
    name: '日系 Chibi',
    subtitle: '萌系动漫小人',
    description: '日系动漫五官、细致发型和轻赛璐璐上色，角色感更强。',
    image: chibiImage,
    tags: ['日系', '赛璐璐', '角色感'],
    stylePrompt: `日系 Chibi 萌系人物插画，精致但简洁的动漫贴纸风格。

只表现用户设定的一个单人角色，全身入镜，采用约二点五到三头身比例：头部明显偏大，身体和四肢短小，但结构清楚。五官可以有明亮的动漫眼睛、小巧的鼻子和嘴巴；脸型、发型、服装、配饰和动作完全以人物设定为准。

背景为纯白色，保留充足留白。使用纤细、干净、略带颜色的轮廓线，发型、眼睛和服装细节比普通简笔 Q 版更丰富。采用柔和的赛璐璐平涂，只保留一层轻微明暗分区，不使用写实光影。颜色优先使用人物设定和配色字段；如果用户没有指定颜色，才使用清爽、精致、亲和的柔和配色。

整体像日系角色贴纸、游戏头像或直播形象中的萌系小人，必须明显区别于彩铅涂鸦。1:1 方形构图，人物居中，全身完整可见，高清。不要添加人物设定未提及的场景和物件，不要使用摄影、3D、复杂光影、多人、文字、Logo 或水印。`,
  },
];
