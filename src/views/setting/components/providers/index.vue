<script setup lang="ts">
import { ref } from 'vue';
import ApiKeySetting from './api-key-setting.vue';
import ProviderAccount from './provider-account.vue';
import type { CredentialService } from '@/types';
import apimartIcon from '@/assets/model-icon/apimart.svg';
import deepseekIcon from '@/assets/model-icon/deepseek.svg';

interface ProviderSetting {
  category: string;
  description: string;
  docsUrl: string;
  icon: string;
  placeholder: string;
  service: CredentialService;
  title: string;
}

const providers: ProviderSetting[] = [
  {
    service: 'apimart',
    title: 'APIMart',
    icon: apimartIcon,
    category: '生图模型厂商',
    description: '用于图片生成服务。Key 只在调用服务时由主进程读取。',
    placeholder: '输入 APIMart API Key',
    docsUrl: 'https://apimart.ai',
  },
  {
    service: 'deepseek',
    title: 'DeepSeek',
    icon: deepseekIcon,
    category: '聊天模型厂商',
    description: '用于角色对话和内容整理。已保存的 Key 不会回传到界面。',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
];

// 凭据变化后递增对应厂商的令牌，账户区据此重新拉取
const accountTokens = ref<Record<string, number>>({});

function handleCredentialUpdated(service: CredentialService) {
  accountTokens.value = {
    ...accountTokens.value,
    [service]: (accountTokens.value[service] ?? 0) + 1,
  };
}
</script>

<template>
  <section aria-label="模型厂商">
    <p class="mb-6 text-sm text-muted-foreground">
      管理各模型厂商的 API
      Key，并查看账户余额与可用模型。凭据由系统安全存储加密，只保存在这台设备上。
    </p>

    <div class="space-y-4">
      <div v-for="provider in providers" :key="provider.service" class="rounded-md border">
        <ApiKeySetting
          :service="provider.service"
          :title="provider.title"
          :description="provider.description"
          :placeholder="provider.placeholder"
          :docs-url="provider.docsUrl"
          :icon="provider.icon"
          :category="provider.category"
          @updated="handleCredentialUpdated(provider.service)"
        />
        <ProviderAccount
          :service="provider.service"
          :refresh-token="accountTokens[provider.service] ?? 0"
        />
      </div>
    </div>
  </section>
</template>
