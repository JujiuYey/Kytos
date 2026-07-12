<script setup lang="ts">
import { ArrowLeftToLine, ArrowRightToLine } from 'lucide-vue-next';
import { useSidebar } from '@/components/ui/sidebar';

const { state, toggleSidebar } = useSidebar();
</script>

<template>
  <SidebarFooter>
    <SidebarMenu>
      <SidebarMenuItem v-if="state === 'collapsed'" @click="toggleSidebar">
        <SidebarMenuButton as-child>
          <ArrowRightToLine class="size-4 cursor-pointer" />
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem v-else>
        <SidebarMenuButton as-child>
          <ArrowLeftToLine class="size-4 cursor-pointer" @click="toggleSidebar" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarFooter>
</template>
