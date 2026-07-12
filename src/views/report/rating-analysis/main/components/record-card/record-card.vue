<script setup lang="ts">
import { ref, watch } from 'vue';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Save,
  Check,
} from 'lucide-vue-next';
import FileUpload from '@/components/sag/file-upload/FileUpload.vue';
import type { DiseaseRecord } from '@/views/report/data-entry/types';

import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';

interface Props {
  record: DiseaseRecord;
  index: number;
}

interface Emits {
  (e: 'update', id: string, data: DiseaseRecord): void;
  (e: 'delete', id: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 是否折叠
const isCollapsed = ref(false);

// 本地编辑副本
const localRecord = ref<DiseaseRecord>({ ...props.record });

// 保存成功状态
const showSaveSuccess = ref(false);

// 监听 props.record 变化，同步到本地
watch(() => props.record, newRecord => {
  localRecord.value = { ...newRecord };
}, { deep: true });

// 保存更改
async function handleSave() {
  try {
    // TODO: 调用 API 保存到数据库
    // await api.updateRecord(localRecord.value);

    // 通知父组件更新 records 数组
    emit('update', props.record.id, localRecord.value);

    // 显示保存成功提示
    showSaveSuccess.value = true;
    setTimeout(() => {
      showSaveSuccess.value = false;
    }, 2000);
  } catch (error) {
    console.error('保存失败:', error);
    // TODO: 显示错误提示
  }
}

// 删除记录
const showDeleteDialog = ref(false);
function handleDelete() {
  showDeleteDialog.value = true;
}
async function confirmDelete() {
  try {
    // TODO: 调用 API 删除记录
    // await api.deleteRecord(props.record.id);

    // 通知父组件从列表移除
    emit('delete', props.record.id);
    showDeleteDialog.value = false;
  } catch (error) {
    console.error('删除失败:', error);
    showDeleteDialog.value = false;
    // TODO: 显示错误提示
  }
}
function cancelDelete() {
  showDeleteDialog.value = false;
}
</script>

<template>
  <Card class="relative">
    <CardHeader class="pb-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
            {{ index + 1 }}
          </div>
          <div>
            <h3 class="font-semibold">
              记录 #{{ index + 1 }}
            </h3>
            <p v-if="record.componentNumber" class="text-xs text-muted-foreground">
              构件编号: {{ record.componentNumber }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- 保存按钮 -->
          <Button
            variant="default"
            size="sm"
            title="保存更改"
            @click="handleSave"
          >
            <Save class="w-4 h-4 mr-1" />
            保存
          </Button>

          <!-- 已保存提示 -->
          <div
            v-if="showSaveSuccess"
            class="flex items-center gap-1 text-sm text-green-600 dark:text-green-500 px-2"
          >
            <Check class="w-4 h-4" />
            已保存
          </div>

          <Button
            variant="outline"
            size="sm"
            title="删除记录"
            @click="handleDelete"
          >
            <Trash2 class="w-4 h-4 text-destructive" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            title="折叠/展开"
            @click="isCollapsed = !isCollapsed"
          >
            <ChevronUp v-if="!isCollapsed" class="w-4 h-4" />
            <ChevronDown v-else class="w-4 h-4" />
          </Button>
        </div>
      </div>
    </CardHeader>

    <CardContent v-show="!isCollapsed" class="space-y-4">
      <!-- 第一行：构件编号 -->
      <div class="grid gap-4">
        <div class="space-y-2">
          <Label>构件编号</Label>
          <Input
            v-model="localRecord.componentNumber"
            placeholder="例如: 1-02-1-1"
          />
        </div>
      </div>

      <!-- 第二行：病害位置和类型 -->
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label>病害位置</Label>
          <Input
            v-model="localRecord.diseaseLocation"
            placeholder="例如: 1#桥面板"
          />
        </div>
        <div class="space-y-2">
          <Label>病害类型</Label>
          <Input
            v-model="localRecord.diseaseType"
            placeholder="例如: 剥落、蜂窝麻面"
          />
        </div>
      </div>

      <!-- 第三行：病害描述 -->
      <div class="space-y-2">
        <Label>病害描述</Label>
        <Textarea
          v-model="localRecord.diseaseDescription"
          placeholder="请输入病害的性质、范围、程度等详细描述"
          rows="3"
        />
      </div>

      <!-- 第四行：病害定量 -->
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label>病害定量 - 数值</Label>
          <Input
            v-model.number="localRecord.quantityValue"
            type="number"
            placeholder="例如: 0.05"
            step="0.01"
          />
        </div>
        <div class="space-y-2">
          <Label>病害定量 - 单位</Label>
          <Input
            v-model="localRecord.quantityUnit"
            placeholder="例如: m²"
          />
        </div>
      </div>

      <!-- 第五行：评定标准 -->
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label>评定标准 (1~5)</Label>
          <Input
            v-model.number="localRecord.evaluationStandard"
            type="number"
            placeholder="请输入1-5之间的数字"
            min="1"
            max="5"
          />
        </div>
        <div class="space-y-2">
          <Label>照片编号</Label>
          <Input
            v-model="localRecord.photoNumber"
            placeholder="例如: 照片5-1"
          />
        </div>
      </div>

      <!-- 第六行：照片上传 -->
      <div class="space-y-2">
        <Label>照片上传</Label>
        <FileUpload
          v-model="localRecord.photos"
          accept="image/*"
          multiple
          :max-size="10"
        />
      </div>
    </CardContent>
  </Card>

  <!-- 删除确认对话框 -->
  <SagConfirmDialog
    v-model:open="showDeleteDialog"
    :title="`确认删除记录 #${index + 1} 吗？`"
    description="此操作不可恢复，确定要删除吗？"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
  />
</template>
