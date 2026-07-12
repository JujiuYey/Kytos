<script setup lang="ts">
import ProjectList from './project-list/project-list.vue';
import Main from './main/main.vue';

import { useProjectProvider } from './composables/useProjectContext';

const projectListRef = ref<InstanceType<typeof ProjectList> | null>(null);

const activeProject = ref<string>();
const activeBridgeId = ref<string>();

/**
 * 选中项目
 */
function handleSelectProject(projectId: string) {
  activeProject.value = projectId;
  activeBridgeId.value = undefined;
}

/**
 * 选中桥梁
 */
function handleSelectBridge(bridgeId: string) {
  activeBridgeId.value = bridgeId;
}

useProjectProvider(activeProject, activeBridgeId);

function handleRefresh() {
  projectListRef.value?.fetchBridgeOptions();
}
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <ProjectList
      ref="projectListRef"
      @selected-project="handleSelectProject"
      @selected-bridge="handleSelectBridge"
    />

    <Main v-if="activeProject" :project-id="activeProject" @refresh="handleRefresh" />
    <div v-else class="flex-1 flex items-center justify-center p-6">
      <p class="text-center text-gray-600 dark:text-gray-400">
        请选择项目
      </p>
    </div>
  </div>
</template>
