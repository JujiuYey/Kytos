<script setup lang="ts">
import ApiKeySetting from './api-key-setting.vue';
import ProviderSidebar from './provider-sidebar.vue';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import type { CredentialService } from '@/types';

interface ProviderSetting {
  category: string;
  description: string;
  docsUrl: string;
  placeholder: string;
  service: CredentialService;
  title: string;
}

const providers: ProviderSetting[] = [
  {
    service: 'apimart',
    title: 'APIMart',
    category: '生图模型厂商',
    description: '用于图片生成服务。Key 只在调用服务时由主进程读取。',
    placeholder: '输入 APIMart API Key',
    docsUrl: 'https://apimart.ai',
  },
  {
    service: 'deepseek',
    title: 'DeepSeek',
    category: '聊天模型厂商',
    description: '用于角色对话和内容整理。已保存的 Key 不会回传到界面。',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    service: 'minimax',
    title: 'MiniMax',
    category: '聊天模型厂商',
    description: '用于接入 MiniMax 文本与多模态模型。已保存的 Key 不会回传到界面。',
    placeholder: '输入 MiniMax API Key',
    docsUrl: 'https://platform.minimaxi.com/docs/guides/quickstart-preparation',
  },
];
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
      <ProviderSidebar :providers="providers" />

      <TabsContent
        v-for="provider in providers"
        :key="provider.service"
        :value="provider.service"
        class="min-w-0 flex-1 sm:mt-0"
      >
        <div class="rounded-md border">
          <ApiKeySetting
            :service="provider.service"
            :title="provider.title"
            :description="provider.description"
            :placeholder="provider.placeholder"
            :docs-url="provider.docsUrl"
          />
        </div>
      </TabsContent>
    </Tabs>
  </section>
</template>
