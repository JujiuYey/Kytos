<script setup lang="ts">
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CredentialService } from '@/types';

defineProps<{
  providers: readonly {
    category: string;
    service: CredentialService;
    title: string;
  }[];
}>();
</script>

<template>
  <TabsList
    aria-label="模型厂商"
    class="h-auto w-full shrink-0 flex-col items-stretch justify-start rounded-md p-1 sm:w-56"
  >
    <TabsTrigger
      v-for="provider in providers"
      :key="provider.service"
      :value="provider.service"
      class="h-auto w-full flex-none flex-col items-start justify-center gap-0.5 px-3 py-3 text-left"
    >
      <span class="font-medium">{{ provider.title }}</span>
      <span class="text-xs font-normal text-muted-foreground">{{ provider.category }}</span>
    </TabsTrigger>
  </TabsList>
</template>
