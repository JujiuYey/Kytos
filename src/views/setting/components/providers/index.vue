<script setup lang="ts">
import ApimartKey from './apimart-key.vue';
import DeepseekKey from './deepseek-key.vue';
import MinimaxKey from './minimax-key.vue';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
</script>

<template>
  <section aria-labelledby="providers-heading">
    <div class="mb-6">
      <h2 id="providers-heading" class="text-base font-semibold">模型厂商</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        管理各模型厂商的 API Key。凭据由系统安全存储加密，只保存在这台设备上。
      </p>
    </div>

    <Tabs default-value="apimart" orientation="vertical" class="gap-4 sm:flex-row sm:gap-8">
      <TabsList
        aria-label="模型厂商"
        class="h-auto w-full shrink-0 flex-col items-stretch justify-start rounded-md p-1 sm:w-56"
      >
        <TabsTrigger
          value="apimart"
          class="h-auto w-full flex-none flex-col items-start justify-center gap-0.5 px-3 py-3 text-left"
        >
          <span class="font-medium">APIMart</span>
          <span class="text-xs font-normal text-muted-foreground">生图模型厂商</span>
        </TabsTrigger>
        <TabsTrigger
          value="deepseek"
          class="h-auto w-full flex-none flex-col items-start justify-center gap-0.5 px-3 py-3 text-left"
        >
          <span class="font-medium">DeepSeek</span>
          <span class="text-xs font-normal text-muted-foreground">聊天模型厂商</span>
        </TabsTrigger>
        <TabsTrigger
          value="minimax"
          class="h-auto w-full flex-none flex-col items-start justify-center gap-0.5 px-3 py-3 text-left"
        >
          <span class="font-medium">MiniMax</span>
          <span class="text-xs font-normal text-muted-foreground">聊天模型厂商</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="apimart" class="min-w-0 flex-1 sm:mt-0">
        <div class="rounded-md border">
          <ApimartKey />
        </div>
      </TabsContent>

      <TabsContent value="deepseek" class="min-w-0 flex-1 sm:mt-0">
        <div class="rounded-md border">
          <DeepseekKey />
        </div>
      </TabsContent>

      <TabsContent value="minimax" class="min-w-0 flex-1 sm:mt-0">
        <div class="rounded-md border">
          <MinimaxKey />
        </div>
      </TabsContent>
    </Tabs>
  </section>
</template>
