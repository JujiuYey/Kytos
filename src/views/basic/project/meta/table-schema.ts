import type { TableColumn } from '@/components/sag/sag-data-table';

// 定义表格列配置
export const columns: TableColumn[] = [
  {
    key: 'name',
    label: '项目名称',
    width: '200px',
    type: 'text',
  },
  {
    key: 'leader',
    label: '负责人',
    width: '120px',
    type: 'text',
  },
  {
    key: 'entrust_unit_name',
    label: '委托单位',
    width: '200px',
    type: 'text',
  },
  {
    key: 'report_writer',
    label: '报告编写',
    width: '120px',
    type: 'text',
  },
  {
    key: 'report_reviewer',
    label: '报告审核',
    width: '120px',
    type: 'text',
  },
  {
    key: 'report_signer',
    label: '报告签发',
    width: '120px',
    type: 'text',
  },
  {
    key: 'status',
    label: '状态',
    width: '80px',
    type: 'badge',
    badgeMap: {
      active: { text: '进行中', variant: 'default' },
      completed: { text: '已完成', variant: 'secondary' },
      pending: { text: '待开始', variant: 'outline' },
    },
  },
  {
    key: 'created_at',
    label: '创建时间',
    width: '150px',
    type: 'date',
  },
];
