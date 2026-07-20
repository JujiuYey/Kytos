<script lang="ts" setup>
import { GalleryVerticalEnd } from '@lucide/vue';
import { SidebarHeader, SidebarMenuButton } from '@/components/ui/sidebar';
</script>

<template>
  <SidebarHeader>
    <SidebarMenuButton
      size="lg"
      class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
    >
      <div
        class="flex items-center justify-center rounded-lg aspect-square size-8 bg-sidebar-primary text-sidebar-primary-foreground"
      >
        <component :is="GalleryVerticalEnd" class="size-4" />
      </div>
      <div class="grid flex-1 text-sm leading-tight text-left">
        <span class="font-semibold truncate">Kytos</span>
      </div>
    </SidebarMenuButton>
  </SidebarHeader>
</template>
