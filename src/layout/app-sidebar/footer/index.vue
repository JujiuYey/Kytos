<script setup lang="ts">
import { ArrowLeftToLine, ArrowRightToLine, Settings } from 'lucide-vue-next';
import { useSidebar } from '@/components/ui/sidebar';
import { useRoute, useRouter } from 'vue-router';

const { state, toggleSidebar } = useSidebar();
const router = useRouter();
const route = useRoute();

const currentKey = computed(() => {
  const pathParts = route.path.split('/').filter(Boolean);
  return pathParts.length > 1 ? pathParts[1] : pathParts[0] || 'home';
});

const getMenuButtonClass = computed(() => ({
  'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground': currentKey.value === 'settings',
  'hover:bg-gray-200 dark:hover:bg-gray-700': currentKey.value !== 'settings',
}));

function handleClick() {
  router.push('/settings');
}
</script>

<template>
  <SidebarFooter>
    <SidebarMenu>
      <SidebarMenuItem @click="handleClick">
        <SidebarMenuButton as-child :class="getMenuButtonClass">
          <span>
            <Settings />
            <span>系统设置</span>
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem v-if="state === 'collapsed'" @click="toggleSidebar">
        <SidebarMenuButton as-child>
          <ArrowRightToLine class="size-4 cursor-pointer" />
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem v-else @click="toggleSidebar">
        <SidebarMenuButton as-child>
          <span>
            <ArrowLeftToLine class="size-4 cursor-pointer" />
            <span>折叠菜单</span>
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarFooter>
</template>
