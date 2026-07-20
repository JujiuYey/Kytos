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
