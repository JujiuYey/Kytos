<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router';
import { computed } from 'vue';
import type { MenuItem } from '../../../data/menu-data';
import { dashboardMenus, basicMenus, reportMenus, aiMenus, systemMenus } from '../../../data/menu-data';

const router = useRouter();
const route = useRoute();

function handleClick(menu: MenuItem) {
  router.push(menu.path);
}
// 获取当前激活的菜单项 key
const currentKey = computed(() => {
  const pathParts = route.path.split('/').filter(Boolean);
  return pathParts.length > 1 ? pathParts[1] : pathParts[0] || 'home';
});

// 获取菜单按钮的类名
const getMenuButtonClass = computed(() => (key: string) => ({
  'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground': key === currentKey.value,
  'hover:bg-gray-200 dark:hover:bg-gray-700': key !== currentKey.value,
}));
</script>

<template>
  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem
            v-for="item of dashboardMenus"
            :key="item.key"
            @click="handleClick(item)"
          >
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

    <SidebarGroup>
      <SidebarGroupLabel>基本数据</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem
            v-for="item of basicMenus"
            :key="item.key"
            @click="handleClick(item)"
          >
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

    <SidebarGroup>
      <SidebarGroupLabel>报告</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem
            v-for="item of reportMenus"
            :key="item.key"
            @click="handleClick(item)"
          >
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

    <SidebarGroup>
      <SidebarGroupLabel>ai功能</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem
            v-for="item of aiMenus"
            :key="item.key"
            @click="handleClick(item)"
          >
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

    <SidebarGroup>
      <SidebarGroupLabel>系统</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem
            v-for="item of systemMenus"
            :key="item.key"
            @click="handleClick(item)"
          >
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
