<script setup lang="ts">
import { ref, computed } from 'vue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Edit, Trash2 } from 'lucide-vue-next';
import type { Disease } from '../../types';

// 创建一个用于表单的临时类型
type DiseaseForm = Omit<Disease, 'id'> & { id: string | null };

const props = defineProps({
  widgetId: {
    type: String,
    default: '',
  },
  modelValue: {
    type: Array,
    default: () => [],
  },
  selectedDisease: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits([
  'update:modelValue',
  'update:selectedDisease',
  'add',
  'edit',
  'delete',
  'select',
]);

const widgetDiseases = computed<Disease[]>({
  get: () => props.modelValue as Disease[],
  set: (value: Disease[]) => emit('update:modelValue', value),
});

const isEditingDisease = ref(false);
const diseaseForm = ref<DiseaseForm>({
  id: null,
  name: '',
  widgetId: props.widgetId,
  sequence: widgetDiseases.value.length + 1,
});

function handleAddDisease() {
  diseaseForm.value = { id: null, name: '', widgetId: props.widgetId, sequence: widgetDiseases.value.length + 1 };
  isEditingDisease.value = true;
  emit('add');
}

function handleEditDisease(disease: Disease) {
  diseaseForm.value = { ...disease };
  isEditingDisease.value = true;
  emit('edit', disease);
}

function saveDisease() {
  if (!diseaseForm.value.name.trim()) {
    return;
  }

  if (diseaseForm.value.id) {
    // Update existing disease
    const index = widgetDiseases.value.findIndex(d => d.id === diseaseForm.value.id);
    if (index !== -1) {
      // 确保类型安全，这里id一定存在
      const updatedDisease = { ...diseaseForm.value, id: diseaseForm.value.id };
      const updatedDiseases = [...widgetDiseases.value];
      updatedDiseases[index] = updatedDisease;
      widgetDiseases.value = updatedDiseases;
      emit('update:selectedDisease', updatedDisease);
    }
  } else {
    // Add new disease
    const newDisease: Disease = {
      ...diseaseForm.value,
      id: Date.now().toString(),
      widgetId: diseaseForm.value.widgetId || props.widgetId,
      sequence: diseaseForm.value.sequence || widgetDiseases.value.length + 1,
    };
    widgetDiseases.value = [...widgetDiseases.value, newDisease];
    emit('update:selectedDisease', newDisease);
  }

  isEditingDisease.value = false;
}

function deleteDisease(id: string) {
  const index = widgetDiseases.value.findIndex(d => d.id === id);
  if (index !== -1) {
    const updatedDiseases = widgetDiseases.value.filter(d => d.id !== id);
    widgetDiseases.value = updatedDiseases;
    emit('delete', id);

    // If the deleted disease was selected, clear the selection
    if (props.selectedDisease?.id === id) {
      emit('update:selectedDisease', null);
    }
  }
}

function handleSelectDisease(disease: Disease) {
  emit('update:selectedDisease', disease);
  emit('select', disease);
}
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <CardTitle class="text-lg">
          病害类型
        </CardTitle>
        <Button size="sm" @click="handleAddDisease">
          <Plus class="h-4 w-4 mr-1" /> 添加
        </Button>
      </div>
    </CardHeader>
    <CardContent class="p-0">
      <ScrollArea class="h-[calc(100vh-300px)]">
        <div class="px-4 space-y-4">
          <!-- 编辑病害表单 -->
          <div v-if="isEditingDisease" class="p-4 rounded-md border border-border bg-card">
            <div class="space-y-4">
              <div class="space-y-2">
                <Label for="disease-name">病害名称</Label>
                <Input id="disease-name" v-model="diseaseForm.name" placeholder="请输入病害名称" />
              </div>
              <div class="flex justify-end space-x-2 pt-2">
                <Button variant="outline" size="sm" @click="isEditingDisease = false">
                  取消
                </Button>
                <Button size="sm" @click="saveDisease">
                  保存
                </Button>
              </div>
            </div>
          </div>

          <!-- 病害列表 -->
          <div class="space-y-3">
            <div
              v-for="disease of widgetDiseases"
              :key="disease.id"
              class="p-3 rounded-md border cursor-pointer transition-all hover:border-primary/50 group relative"
              :class="{
                'border-primary bg-primary/5': selectedDisease?.id === disease.id,
                'border-border': selectedDisease?.id !== disease.id,
              }"
              @click="handleSelectDisease(disease)"
            >
              <div class="flex justify-between items-start">
                <div>
                  <div class="font-medium text-foreground">
                    {{ disease.name }}
                  </div>
                  <div class="text-sm text-muted-foreground mt-1">
                    排序: {{ disease.sequence }}
                  </div>
                </div>
                <div class="flex space-x-1 opacity-0 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6 text-muted-foreground hover:text-foreground"
                    @click.stop="handleEditDisease(disease)"
                  >
                    <Edit class="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6 text-destructive/80 hover:text-destructive"
                    @click.stop="deleteDisease(disease.id)"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="widgetDiseases.length === 0" class="p-6 text-center text-muted-foreground border border-dashed rounded-md">
            <div class="flex flex-col items-center justify-center space-y-2">
              <span class="text-sm">暂无病害数据</span>
              <Button variant="outline" size="sm" class="mt-2" @click="handleAddDisease">
                <Plus class="h-4 w-4 mr-1" /> 添加病害
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </CardContent>
  </Card>
</template>
