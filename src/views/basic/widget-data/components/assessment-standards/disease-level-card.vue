<script setup lang="ts">
import { Save } from 'lucide-vue-next';
import type { Disease, DiseaseLevel } from '../../types';

const props = defineProps<{
  disease: Disease | null;
  levels: DiseaseLevel[];
  selectedLevel: DiseaseLevel | null;
}>();

const emit = defineEmits<{
  (e: 'save'): void;
}>();

const isEditing = ref(false);
const levelForms = ref<Array<Partial<DiseaseLevel>>>([]);

// Initialize 5 forms for levels 1-5
function initializeForms() {
  levelForms.value = Array.from({ length: 5 }).fill(0).map((_, index) => ({
    diseaseId: props.disease?.id,
    scale: index + 1,
    quantifier: '',
    qualitative: '',
  }));
}

// Initialize forms when component mounts or disease changes
watch(() => props.disease, newDisease => {
  if (newDisease) {
    initializeForms();
  }
}, { immediate: true });

function handleSave() {
  initializeForms();
  isEditing.value = true;
  emit('save');
}
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <CardTitle class="text-lg">
          {{ disease ? `${disease.name} - 病害等级` : '请选择病害类型' }}
        </CardTitle>
        <Button
          v-if="disease"
          :disabled="!disease"
          size="sm"
          @click="handleSave"
        >
          <Save class="h-4 w-4 mr-1" /> 保存
        </Button>
      </div>
    </CardHeader>
    <CardContent class="p-0">
      <ScrollArea class="h-[calc(100vh-200px)]">
        <div class="px-4 space-y-4">
          <!-- 编辑等级表单 -->
          <div class="space-y-4">
            <div
              v-for="(form, index) of levelForms"
              :key="index"
              class="p-4 rounded-md border border-border bg-card transition-all hover:shadow-md"
              :class="{
                'border-l-4 border-l-blue-500': form.scale === 1,
                'border-l-4 border-l-green-500': form.scale === 2,
                'border-l-4 border-l-yellow-500': form.scale === 3,
                'border-l-4 border-l-orange-500': form.scale === 4,
                'border-l-4 border-l-red-500': form.scale === 5,
                'mb-4': index < levelForms.length - 1,
              }"
            >
              <div class="space-y-2">
                <h4 class="font-medium text-sm flex items-center">
                  <span
                    class="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold mr-2"
                    :class="{
                      'bg-blue-100 text-blue-800': form.scale === 1,
                      'bg-green-100 text-green-800': form.scale === 2,
                      'bg-yellow-100 text-yellow-800': form.scale === 3,
                      'bg-orange-100 text-orange-800': form.scale === 4,
                      'bg-red-100 text-red-800': form.scale === 5,
                    }"
                  >
                    {{ form.scale }}
                  </span>
                  <span class="font-bold">标度 {{ form.scale }}</span>
                </h4>
                <div class="space-y-2">
                  <Label>定量描述</Label>
                  <Textarea
                    v-model="form.quantifier"
                    :placeholder="`${form.scale}级定量描述`"
                  />
                </div>
                <div class="space-y-2">
                  <Label>定性描述</Label>
                  <Textarea
                    v-model="form.qualitative"
                    :placeholder="`${form.scale}级定性描述`"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="!disease"
            class="p-6 text-center text-muted-foreground border border-dashed rounded-md"
          >
            <div class="flex flex-col items-center justify-center space-y-2">
              <span class="text-sm">请先选择病害类型</span>
            </div>
          </div>
        </div>
      </ScrollArea>
    </CardContent>
  </Card>
</template>
