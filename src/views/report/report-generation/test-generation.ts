import type { DocumentSchema, DocumentData } from '@/composables/use-generate-docx';
import {
  AlignmentType,
} from 'docx';

// 1. 定义文档结构Schema（可单独存为.json文件，通过import导入）
const employeeSchema: DocumentSchema = {
  styles: {
    paragraphStyles: [
      {
        id: 'heading',
        name: '标题样式',
        run: { size: 32, bold: true },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 200 } },
      },
      {
        id: 'content',
        name: '内容样式',
        run: { size: 22, color: '#666666' },
        paragraph: { spacing: { after: 100 } },
      },
    ],
  },
  sections: [
    {
      children: [
        // 标题
        {
          type: 'heading',
          text: '${title}',
          level: 'HEADING_1',
          style: 'heading',
        },

        // 个人信息段落
        {
          type: 'paragraph',
          style: 'content',
          children: [
            { text: '员工姓名：', bold: true },
            { text: '${employeeName}' },
          ],
        },
        {
          type: 'paragraph',
          style: 'content',
          children: [
            { text: '员工编号：', bold: true },
            { text: '${employeeId}' },
          ],
        },
        {
          type: 'paragraph',
          style: 'content',
          children: [
            { text: '入职日期：', bold: true },
            { text: '${hireDate}' },
          ],
        },

        // 福利表格
        {
          type: 'heading',
          text: '福利待遇',
          level: 'HEADING_2',
        },
        {
          type: 'table',
          header: ['福利名称', '详情'],
          dataKey: 'benefits',
          columns: [
            { field: 'name' },
            { field: 'detail' },
          ],
        },

        // 确认部分
        {
          type: 'paragraph',
          text: '本人已阅读并确认上述信息',
          alignment: 'RIGHT',
          spacing: { before: 300 },
        },
        {
          type: 'paragraph',
          text: '确认人：${employeeName}',
          alignment: 'RIGHT',
          spacing: { before: 100 },
        },
      ],
    },
  ],
};

// 2. 准备数据（实际应用中可从数据库/接口获取）
const employeeData: DocumentData = {
  title: '员工入职确认书',
  employeeName: '张三',
  employeeId: 'EMP2023001',
  hireDate: '2023-10-01',
  benefits: [
    { name: '医疗保险', detail: '涵盖门诊和住院' },
    { name: '带薪年假', detail: '每年15天' },
    { name: '年终奖', detail: '根据业绩评定' },
  ],
};

// 3. 生成文档
export async function handleTestGeneration() {
  generateDocx(
    employeeSchema,
    employeeData,
    'test',
  );
}
