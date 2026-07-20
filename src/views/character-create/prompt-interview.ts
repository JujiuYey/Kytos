import type { CharacterPromptDraft, CharacterPromptMessage } from './workflow-data';

export const PROMPT_REPLY_DELAY_MS = 550;

const COLOR_WORDS = [
  '深海军蓝',
  '深灰蓝',
  '银灰蓝',
  '深棕色',
  '浅米白',
  '珊瑚粉',
  '钴蓝色',
  '浅蓝色',
  '深蓝色',
  '纯白色',
  '黑色',
  '白色',
  '蓝色',
  '黄色',
  '红色',
  '绿色',
  '灰色',
  '粉色',
  '紫色',
  '橙色',
  '浅蓝',
  '纯白',
  '蓝白',
] as const;

const DRAFT_FIELD_LABELS: Record<keyof CharacterPromptDraft, string> = {
  age: '年龄',
  gender: '性别',
  hairColor: '头发颜色',
  hairstyle: '头发长短 / 发型',
  clothingColor: '衣服颜色',
  clothingStyle: '衣服款式',
  clothingLength: '衣服长短',
  bottomsColor: '裤子 / 裙子颜色',
  bottomsStyle: '裤子 / 裙子款式',
  bottomsLength: '裤子 / 裙子长短',
  shoesColor: '鞋子颜色',
  shoesStyle: '鞋子款式',
  shoesHeight: '鞋子长短 / 高度',
  accessories: '可选配饰',
  props: '可选物品 / 道具',
  characterMood: '角色气质',
  primaryColor: '主色',
  secondaryColor: '辅助色',
  accentColor: '强调色',
  backgroundColor: '背景色',
  forbiddenColors: '禁用颜色',
  overallStyleKeywords: '整体风格关键词',
};

export function getPromptSuggestions(answerCount: number, styleName?: string): string[] {
  if (answerCount === 0) return ['25 岁男性，黑色短碎发', '年轻女性，深棕色长卷发'];
  if (answerCount === 1) {
    return ['浅蓝卫衣、白色长裤、白色低帮运动鞋', '黄色短袖、蓝色短裤、红色圆头鞋'];
  }
  if (answerCount === 2) {
    const styleDirection = styleName ? `保持${styleName}风格` : '整体使用清晰简洁的插画风格';
    return [`不加配饰和道具，温和自信，蓝白主色，纯白背景，${styleDirection}`];
  }
  return [];
}

export function getPromptOpening(hasReferenceImage: boolean, styleName?: string): string {
  const sourceSummary = hasReferenceImage
    ? '我会把你上传的照片作为人物参考。'
    : '没有参考照片也没关系，我会通过接下来的对话整理人物形象。';
  const styleSummary = styleName
    ? `你选择了「${styleName}」作为起始风格，我会保留它的核心画面语言。`
    : '你没有预选风格，我也会根据对话内容帮你整理整体画面语言。';
  return `${sourceSummary}\n\n${styleSummary}\n\n先告诉我人物的**年龄、性别、发色和发型**，一句话回答就可以。`;
}

export function getPromptReply(answerCount: number, hadCompiledPrompt: boolean): string {
  if (answerCount === 1) {
    return '好的。接着说说人物的**上装、下装和鞋子**，包括颜色、款式以及长短；不确定的部分可以交给我处理。';
  }
  if (answerCount === 2) {
    return '最后补充一下：是否需要**配饰或道具**？你希望角色呈现什么气质？主色、辅助色、强调色、背景色、不想出现的颜色以及**整体风格关键词**分别是什么？';
  }
  return hadCompiledPrompt
    ? '这次调整也已经合并到最终提示词里了，可以继续补充，或者进入下一步生成图片。'
    : '人物信息已经足够清楚，我已结合风格设定整理出最终提示词。你可以继续微调，或者进入下一步生成图片。';
}

export function extractPromptDraft(
  draft: CharacterPromptDraft,
  answer: string,
  answerCount: number,
): CharacterPromptDraft {
  const next = { ...draft };
  if (answerCount === 1 || /(岁|少年|青年|年轻|中年|老年|男性|女性|男生|女生|发)/.test(answer)) {
    next.age = answer.match(/\d{1,3}\s*岁|少年|青年|年轻|中年|老年/)?.[0] ?? next.age;
    next.gender = answer.match(/男性|女性|男生|女生|男孩|女孩|中性/)?.[0] ?? next.gender;
    const hair = findSegment(answer, /发/) || answer;
    next.hairColor = findColor(hair) || next.hairColor;
    next.hairstyle =
      hair
        .replace(/\d{1,3}\s*岁|少年|青年|年轻|中年|老年|男性|女性|男生|女生|男孩|女孩|中性/g, '')
        .replace(findColor(hair), '')
        .trim() || next.hairstyle;
  }

  if (answerCount === 2 || /(衣|衫|袖|裤|裙|鞋|卫衣|外套)/.test(answer)) {
    const clothing = findSegment(answer, /衣|衫|袖|卫衣|外套|毛衣|上装/);
    const bottoms = findSegment(answer, /裤|裙/);
    const shoes = findSegment(answer, /鞋/);
    if (clothing) {
      next.clothingColor = findColor(clothing) || next.clothingColor;
      next.clothingStyle = withoutColor(clothing) || next.clothingStyle;
      next.clothingLength =
        clothing.match(/短袖|长袖|无袖|七分袖|九分袖/)?.[0] ?? next.clothingLength;
    }
    if (bottoms) {
      next.bottomsColor = findColor(bottoms) || next.bottomsColor;
      next.bottomsStyle = withoutColor(bottoms) || next.bottomsStyle;
      next.bottomsLength =
        bottoms.match(/短裤|长裤|九分裤|七分裤|短裙|长裙|及膝/)?.[0] ?? next.bottomsLength;
    }
    if (shoes) {
      next.shoesColor = findColor(shoes) || next.shoesColor;
      next.shoesStyle = withoutColor(shoes) || next.shoesStyle;
      next.shoesHeight = shoes.match(/低帮|高帮|中帮|短靴|长靴/)?.[0] ?? next.shoesHeight;
    }
  }

  if (answerCount >= 3 || /(配饰|道具|气质|主色|辅助色|强调色|背景|禁用|风格)/.test(answer)) {
    const hasNoAccessories = /不加配饰|没有配饰|无配饰/.test(answer);
    const hasNoProps = /不加[^，。；]*道具|没有[^，。；]*道具|无道具/.test(answer);
    const accessories = findSegment(answer, /配饰|眼镜|帽|耳环|项链|手表/);
    const props = findSegment(answer, /道具|物品|手持|拿着|背着/);
    const mood = findSegment(answer, /温和|自信|活泼|安静|冷静|可爱|专业|亲和|酷|气质/);
    const primaryColor = answer.match(/([^，。；,;]{1,12})主色/)?.[1]?.trim();
    const secondaryColor = answer.match(/辅助色[：:]?([^，。；,;]{1,12})/)?.[1]?.trim();
    const accentColor = answer.match(/强调色[：:]?([^，。；,;]{1,12})/)?.[1]?.trim();
    const background = findSegment(answer, /背景/);
    const forbidden = findSegment(answer, /禁用|不要|不想.*颜色/);
    const styleKeywords = findSegment(answer, /风格/);

    next.accessories = hasNoAccessories ? '无' : accessories || next.accessories;
    next.props = hasNoProps ? '无' : props || next.props;
    next.characterMood = mood || next.characterMood;
    next.primaryColor = primaryColor || next.primaryColor;
    next.secondaryColor = secondaryColor || next.secondaryColor;
    next.accentColor = accentColor || next.accentColor;
    next.backgroundColor = background
      ? background.replace('背景', '').trim()
      : next.backgroundColor;
    next.forbiddenColors = forbidden || next.forbiddenColors;
    next.overallStyleKeywords =
      next.overallStyleKeywords || styleKeywords.replace(/整体|使用|保持|风格|偏/g, '').trim();
  }

  return next;
}

export function buildFinalPrompt(options: {
  draft: CharacterPromptDraft;
  messages: CharacterPromptMessage[];
  hasReferenceImage: boolean;
  stylePrompt?: string;
}): string {
  const source = options.hasReferenceImage
    ? '以用户上传的照片作为人物外貌参考，保留可辨认的脸部、发型和体态特征。'
    : '没有人物参考照片，以访谈中确认的形象信息为准。';
  const answers = options.messages
    .filter(message => message.role === 'user')
    .map(message => message.content)
    .join('；');
  const structuredDetails = Object.entries(options.draft)
    .filter(([, value]) => Boolean(value.trim()))
    .map(([key, value]) => `${DRAFT_FIELD_LABELS[key as keyof CharacterPromptDraft]}：${value}`)
    .join('；');
  const stylePrompt =
    options.stylePrompt ??
    (options.draft.overallStyleKeywords
      ? `整体风格关键词：${options.draft.overallStyleKeywords}。`
      : '不预设固定画风，根据人物设定选择协调、清晰的插画表现方式。');

  return `请生成一张单人角色形象图。人物设定优先于风格范例中的性别、年龄、发型、服装、配色和配饰等示例细节；风格提示词只用于确定画法、线条、形体比例、色彩方式和画面质感。

${source}

结构化人物设定：${structuredDetails || '暂无已确认字段'}。

访谈中的其他补充：${answers || '暂无额外补充'}。

风格要求：
${stylePrompt}

最终优先级：人物设定和配色字段最高；风格要求只负责表现技法。若两者冲突，必须使用人物设定和配色字段，不能用风格默认值覆盖用户明确指定的内容。`.slice(
    0,
    5000,
  );
}

function findColor(value: string): string {
  return COLOR_WORDS.find(color => value.includes(color)) ?? '';
}

function withoutColor(value: string): string {
  const color = findColor(value);
  return color ? value.replace(color, '').trim() : value.trim();
}

function findSegment(value: string, pattern: RegExp): string {
  return (
    value
      .split(/[，,；;。]/)
      .map(segment => segment.trim())
      .find(segment => pattern.test(segment)) ?? ''
  );
}
