<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router';
import { computed } from 'vue';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { menuGroups } from '@/data/menu-data';
import type { MenuItem } from '@/data/menu-data';

const router = useRouter();
const route = useRoute();

function handleClick(menu: MenuItem) {
  router.push(menu.path);
}

const currentKey = computed(() => {
  const pathParts = route.path.split('/').filter(Boolean);
  const rootKey = pathParts[0] ?? 'home';
  if (rootKey === 'character-visual' || rootKey === 'character-portrait') {
    return 'character-anchor';
  }
  if (rootKey === 'character-action') {
    return 'character-action';
  }
  if (rootKey === 'character-expression') {
    return rootKey;
  }
  const key = pathParts.length > 1 ? (pathParts[1] ?? 'home') : rootKey;
  return key === 'character' ? 'characters' : key;
});

const getMenuButtonClass = computed(() => (key: string) => ({
  'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground':
    key === currentKey.value,
  'hover:bg-gray-200 dark:hover:bg-gray-700': key !== currentKey.value,
}));
</script>

<template>
  <SidebarContent>
    <SidebarGroup v-for="group of menuGroups" :key="group.label">
      <SidebarGroupLabel>{{ group.label }}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem v-for="item of group.items" :key="item.key" @click="handleClick(item)">
            <SidebarMenuButton as-child :class="getMenuButtonClass(item.key)">
              <span>
                <component :is="item.icon" />
                <span>{{ item.title }}</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
</template>
