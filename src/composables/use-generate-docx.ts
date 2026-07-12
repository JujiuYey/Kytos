import type { ISectionOptions } from 'docx';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import { writeFile, exists } from '@tauri-apps/plugin-fs';
import { BaseDirectory } from '@tauri-apps/api/path';
import { toast } from 'vue-sonner';

// ------------------------------
// 类型定义
// ------------------------------

/** 文档元素类型 */
type DocElementType = 'heading' | 'paragraph' | 'table';

/** 对齐方式类型（与docx库对齐） */
type Alignment = 'LEFT' | 'RIGHT' | 'CENTER' | 'JUSTIFIED';

/** 标题级别类型 */
type HeadingLevelType = 'HEADING_1' | 'HEADING_2' | 'HEADING_3' | 'HEADING_4' | 'HEADING_5' | 'HEADING_6';

/** 段落文本运行项（用于富文本） */
interface TextRunItem {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

/** 段落间距配置 */
interface SpacingConfig {
  before?: number;
  after?: number;
  line?: number;
}

/** Schema中的基础元素配置 */
interface BaseElement {
  type: DocElementType;
  style?: string;
  alignment?: Alignment;
}

/** 标题元素配置 */
interface HeadingElement extends BaseElement {
  type: 'heading';
  text: string;
  level: HeadingLevelType;
}

/** 段落元素配置 */
interface ParagraphElement extends BaseElement {
  type: 'paragraph';
  // 简单文本（与children二选一）
  text?: string;
  // 富文本（与text二选一）
  children?: TextRunItem[];
  spacing?: SpacingConfig;
}

/** 表格列配置 */
interface TableColumn {
  // 数据字段名（与text二选一）
  field?: string;
  // 固定文本（与field二选一）
  text?: string;
}

/** 表格元素配置 */
interface TableElement extends BaseElement {
  type: 'table';
  // 表头文本数组
  header: string[];
  // 对应数据源中的数组键名
  dataKey: string;
  // 列配置
  columns: TableColumn[];
}

/** 文档中的所有元素类型联合 */
type DocElement = HeadingElement | ParagraphElement | TableElement;

/** 文档样式配置 */
interface DocStyles {
  paragraphStyles: any[];
}

/** 文档章节配置 */
interface DocSection {
  properties?: ISectionOptions;
  children: DocElement[];
}

/** 完整文档Schema配置 */
export interface DocumentSchema {
  styles?: DocStyles;
  sections: DocSection[];
}

/** 数据源类型（泛型） */
export type DocumentData = Recordable;

// ------------------------------
// 核心解析逻辑
// ------------------------------

/**
 * 解析占位符，替换为实际数据
 * @param value 可能包含占位符的字符串（如"${name}"）
 * @param data 数据源
 * @returns 替换后的内容
 */
function resolveValue(value: string, data: DocumentData): string {
  if (!value) {
    return value;
  }

  return value.replace(/\$\{(\w+)\}/g, (_, key) => {
    return data[key] !== undefined ? String(data[key]) : `\${${key}}`;
  });
}

/**
 * 将Schema中的对齐方式转换为docx库的枚举值
 * @param alignment 对齐方式字符串
 * @returns AlignmentType枚举值
 */
function getAlignment(alignment?: Alignment): any | undefined {
  if (!alignment) {
    return undefined;
  }
  return AlignmentType[alignment as keyof typeof AlignmentType];
}

/**
 * 将Schema中的标题级别转换为docx库的枚举值
 * @param level 标题级别字符串
 * @returns HeadingLevel枚举值
 */
function getHeadingLevel(level: HeadingLevelType): any {
  return HeadingLevel[level as keyof typeof HeadingLevel];
}

/**
 * Schema解析器：将文档结构配置转换为docx.js对象
 * @param schema 文档结构配置
 * @param data 注入的数据
 * @returns docx.js文档对象
 */
function parseSchema(schema: DocumentSchema, data: DocumentData): Document {
  // 解析样式
  const styles = schema.styles
    ? {
        paragraphStyles: schema.styles.paragraphStyles.map(style => ({
          ...style,
          paragraph: style.paragraph
            ? {
                ...style.paragraph,
                alignment: style.paragraph.alignment
                  ? getAlignment(style.paragraph.alignment as Alignment)
                  : undefined,
              }
            : undefined,
        })),
      }
    : {};

  // 解析章节内容
  const sections = schema.sections.map(section => ({
    properties: section.properties || {},
    children: section.children.map(element => {
      switch (element.type) {
        case 'heading':
          return new Paragraph({
            text: resolveValue(element.text, data),
            heading: getHeadingLevel(element.level),
            style: element.style,
            alignment: getAlignment(element.alignment),
          });

        case 'paragraph':
          return new Paragraph({
            children: element.children
              ? element.children.map(child => new TextRun({
                  text: resolveValue(child.text, data),
                  bold: child.bold,
                  italics: child.italic,
                  color: child.color,
                }))
              : [new TextRun(resolveValue(element.text || '', data))],
            style: element.style,
            alignment: getAlignment(element.alignment),
            spacing: element.spacing,
          });

        case 'table': {
          const dataArray = data[element.dataKey] as Recordable[];
          if (!Array.isArray(dataArray)) {
            throw new TypeError(`表格数据源${element.dataKey}不是数组`);
          }

          // 表头行
          const headerRow = new TableRow({
            children: element.header.map(text => new TableCell({
              children: [new Paragraph(resolveValue(text, data))],
            })),
          });

          // 数据行
          const dataRows = dataArray.map(item => new TableRow({
            children: element.columns.map(col => new TableCell({
              children: [new Paragraph(
                col.field
                  ? resolveValue(String(item[col.field] || ''), data)
                  : resolveValue(col.text || '', data),
              )],
            })),
          }));

          return new Table({
            rows: [headerRow, ...dataRows],
          });
        }

        default:
          throw new Error(`不支持的元素类型: ${(element as BaseElement).type}`);
      }
    }),
  }));

  return new Document({ styles, sections });
}

/**
 * 生成文档的主函数
 * @param schema 文档结构配置
 * @param data 注入的数据
 * @param outputPath 输出路径
 */
export async function generateDocx(
  schema: DocumentSchema,
  data: DocumentData,
  fileName: string,
): Promise<void> {
  try {
    const doc = parseSchema(schema, data);
    const base64String = await Packer.toBase64String(doc);
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const tokenExists = await exists(`${fileName}.docx`, {
      baseDir: BaseDirectory.Download,
    });

    if (tokenExists) {
      toast.warning('文件已存在');
      return;
    }

    // 写入文件
    await writeFile(`${fileName}.docx`, bytes, {
      baseDir: BaseDirectory.Download,
    });
  } catch (err) {
    toast.error('生成失败', {
      description: String(err),
    });
    throw err;
  }
}
