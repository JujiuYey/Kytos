import { Document, Paragraph, TextRun, Packer, AlignmentType, UnderlineType } from 'docx';
import { writeFile, exists } from '@tauri-apps/plugin-fs';
import { BaseDirectory } from '@tauri-apps/api/path';
import { toast } from 'vue-sonner';

// 创建文档
const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: 1440,
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children: [
        // 顶部提示文字
        new Paragraph({
          children: [
            new TextRun({
              text: '[未选择标题元素]',
              size: 20,
              color: '#000000',
            }),
          ],
          alignment: AlignmentType.RIGHT,
          spacing: {
            after: 1440,
          },
        }),

        // 主标题
        new Paragraph({
          children: [
            new TextRun({
              text: 'XXXXXXXXXX桥',
              size: 36,
              bold: true,
              color: '#000000',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: {
            after: 720,
          },
        }),

        // 副标题
        new Paragraph({
          children: [
            new TextRun({
              text: '(XXXXXX) 2025年定期检查报告',
              size: 28,
              color: '#000000',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: {
            after: 720,
          },
        }),

        // 报告编号（带虚线下划线）
        new Paragraph({
          children: [
            new TextRun({
              text: '报告编号: XXXXXXXXXXXX',
              size: 22,
              color: '#000000',
              underline: {
                type: UnderlineType.DASH,
                color: '#FF0000',
              },
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: {
            after: 2880,
          },
        }),

        // 检测公司
        new Paragraph({
          children: [
            new TextRun({
              text: 'XXXXXXXX检测有限公司（盖章）',
              size: 24,
              color: '#000000',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: {
            after: 360,
          },
        }),

        // 日期
        new Paragraph({
          children: [
            new TextRun({
              text: '2025年08月16日',
              size: 24,
              color: '#000000',
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
    },
  ],
});

export async function generateDocx() {
  try {
    const base64String = await Packer.toBase64String(doc);
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const tokenExists = await exists(`test-1.docx`, {
      baseDir: BaseDirectory.Download,
    });

    if (tokenExists) {
      toast.warning('文件已存在');
      return;
    }

    // 写入文件
    await writeFile(`test-1.docx`, bytes, {
      baseDir: BaseDirectory.Download,
    });
  } catch (err) {
    toast.error('生成失败', {
      description: String(err),
    });
    throw err;
  }
}
