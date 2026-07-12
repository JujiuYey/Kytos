<script lang="ts" setup>
import { ref, computed } from 'vue';
import { Search } from 'lucide-vue-next';
import { projectService } from '@/api/project';
import { bridgeService } from '@/api/bridge';
import { toast } from 'vue-sonner';

const emit = defineEmits<{
  (e: 'selectedProject', projectId: string): void;
  (e: 'selectedBridge', bridgeId: string): void;
}>();

/**
 * 获取项目列表
 */
const projectOptions = ref<Recordable[]>([]);
const activeProject = ref<string>('');
async function fetchProjectOptions() {
  try {
    const options = await projectService.options();
    projectOptions.value = options;
  } catch (error) {
    toast.error(`${error}`);
  }
}

onMounted(() => {
  fetchProjectOptions();
});

/**
 * 过滤桥梁类型
 */
const searchQuery = ref('');
const filteredProjects = computed(() => {
  if (!searchQuery.value) {
    return projectOptions.value;
  }
  const query = searchQuery.value.toLowerCase();
  return projectOptions.value.filter(project =>
    project.name.includes(query),
  );
});

/**
 * 选中项目
 */
function handleSelectProject(projectId: string) {
  activeProject.value = projectId;
  emit('selectedProject', projectId);

  fetchBridgeOptions();
}

/**
 * 获取桥梁列表
 */
const bridgeOptions = ref<Recordable[]>([]);
async function fetchBridgeOptions() {
  if (!activeProject.value) {
    return;
  }

  try {
    const options = await bridgeService.options(activeProject.value);
    bridgeOptions.value = options;
  } catch (error) {
    toast.error(`${error}`);
  }
}

const activeBridgeId = ref<string>();

/**
 * 选中桥梁
 */
function handleSelectBridge(bridgeId: string) {
  activeBridgeId.value = bridgeId;
  emit('selectedBridge', bridgeId);
}

defineExpose({
  fetchProjectOptions,
  fetchBridgeOptions,
});
</script>

<template>
  <div class="w-64 border-r p-2 flex flex-col">
    <h2 class="text-lg font-semibold mb-4">
      项目列表
    </h2>

    <!-- 搜索框 -->
    <div class="mb-4">
      <div class="relative">
        <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          type="search"
          placeholder="搜索项目..."
          class="w-full pl-8"
        />
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <Accordion type="single" collapsible>
        <AccordionItem
          v-for="project of filteredProjects" :key="project.id"
          :value="project.id"
          class="p-2 rounded-md hover:bg-accent cursor-pointer mb-1"
          :class="{ 'bg-accent': activeProject === project.id }"
          @click="handleSelectProject(project.id)"
        >
          <AccordionTrigger>
            <span>{{ project.name }}</span>
          </AccordionTrigger>
          <AccordionContent>
            <div v-if="bridgeOptions.length > 0" class="space-y-2">
              <div
                v-for="bridge of bridgeOptions"
                :key="bridge.id"
                class="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm cursor-pointer"
                :class="{
                  '!bg-primary text-primary-foreground': activeBridgeId === bridge.id,
                }"
                @click.stop="handleSelectBridge(bridge.id)"
              >
                <div class="flex items-center">
                  <span class="text-sm">{{ bridge.bridge_name }}</span>
                </div>
              </div>
            </div>
            <div v-else class="text-sm text-muted-foreground italic pl-4">
              暂无桥梁数据
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  </div>
</template>
