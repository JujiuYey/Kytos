<script lang="ts" setup>
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from './app-sidebar/index.vue';
</script>

<template>
  <SidebarProvider :default-open="true">
    <AppSidebar />
    <div class="w-[0px] flex-1 h-screen">
      <RouterView />
    </div>
  </SidebarProvider>
</template>
