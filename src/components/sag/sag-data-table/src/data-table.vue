<script setup lang="ts" generic="T extends Recordable">
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TableColumn } from '../types';

withDefaults(defineProps<Props>(), {
  showIndex: false,
});

const emit = defineEmits<{
  (e: 'rowDblclick', row: T, index: number): void;
}>();

interface Props {
  // 表格数据
  data: T[];
  // 列配置
  columns: Array<TableColumn<T>>;
  // 是否显示序号列
  showIndex?: boolean;
}

// 格式化日期
function formatDate(date: Date | string) {
  if (!date) {
    return '-';
  }
  return new Date(date).toLocaleDateString('zh-CN');
}

// 渲染单元格内容
function renderCell(column: TableColumn<T>, row: T) {
  const value = row[column.key];

  // 优先使用自定义渲染函数
  if (column.render) {
    return column.render(row, value);
  }

  // 根据类型渲染
  switch (column.type) {
    case 'date':
      return formatDate(value);
    case 'badge':
      return column.badgeMap?.[value] || { text: String(value), variant: 'default' };
    case 'text':
    default:
      // 使用枚举映射
      if (column.enumMap && value !== undefined && value !== null) {
        return column.enumMap[value] ?? value;
      }
      return value ?? '-';
  }
}

// 获取文本对齐类
function getAlignClass(align?: 'left' | 'center' | 'right') {
  switch (align) {
    case 'center':
      return 'text-center';
    case 'right':
      return 'text-right';
    default:
      return 'text-left';
  }
}
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead v-if="showIndex" class="w-[60px]">
            序号
          </TableHead>
          <TableHead
            v-for="column of columns"
            :key="column.key"
            :class="[getAlignClass(column.align)]"
            :style="{ width: column.width }"
          >
            {{ column.label }}
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        <TableRow
          v-for="(row, index) of data"
          :key="index"
          class="cursor-pointer hover:bg-muted/50 transition-colors"
          @dblclick="emit('rowDblclick', row, index)"
        >
          <TableCell v-if="showIndex">
            {{ index + 1 }}
          </TableCell>

          <TableCell
            v-for="column of columns"
            :key="column.key"
            :class="[getAlignClass(column.align)]"
          >
            <!-- 头像类型 -->
            <Avatar v-if="column.type === 'avatar'" class="h-8 w-8">
              <AvatarImage
                :src="row[column.avatarConfig?.srcKey || column.key] || ''"
                :alt="row[column.avatarConfig?.fallbackKey || 'name'] || ''"
              />
              <AvatarFallback>
                {{ (row[column.avatarConfig?.fallbackKey || 'name'] || '未知')?.charAt(0) }}
              </AvatarFallback>
            </Avatar>

            <!-- Badge 类型 -->
            <Badge
              v-else-if="column.type === 'badge'"
              :variant="renderCell(column, row).variant"
            >
              {{ renderCell(column, row).text }}
            </Badge>

            <!-- 操作按钮 -->
            <div
              v-else-if="column.type === 'actions' && column.actions"
              class="flex justify-center gap-2"
            >
              <Button
                v-for="(action, actionIndex) of column.actions"
                :key="actionIndex"
                :variant="action.variant || 'outline'"
                size="sm"
                @click="action.onClick(row)"
              >
                {{ action.label }}
              </Button>
            </div>

            <!-- 普通文本 -->
            <template v-else>
              {{ renderCell(column, row) }}
            </template>
          </TableCell>
        </TableRow>

        <!-- 空状态 -->
        <TableRow v-if="data.length === 0">
          <TableCell
            :colspan="columns.length + (showIndex ? 1 : 0)"
            class="h-24 text-center text-muted-foreground"
          >
            暂无数据
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
