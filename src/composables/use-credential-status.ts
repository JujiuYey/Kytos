import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import type { CredentialStatus } from '@/types';

export interface CredentialStatusBundle {
  deepseekStatus: Ref<CredentialStatus | null>;
  apimartStatus: Ref<CredentialStatus | null>;
  deepseekConfigured: ComputedRef<boolean>;
  apimartConfigured: ComputedRef<boolean>;
  refresh: () => Promise<void>;
}

export function useCredentialStatus(): CredentialStatusBundle {
  const deepseekStatus = ref<CredentialStatus | null>(null);
  const apimartStatus = ref<CredentialStatus | null>(null);

  const deepseekConfigured = computed(() => Boolean(deepseekStatus.value?.configured));
  const apimartConfigured = computed(() => Boolean(apimartStatus.value?.configured));

  async function refresh(): Promise<void> {
    const [deepseek, apimart] = await Promise.all([
      window.desktop.settings.getCredentialStatus('deepseek'),
      window.desktop.settings.getCredentialStatus('apimart'),
    ]);
    deepseekStatus.value = deepseek;
    apimartStatus.value = apimart;
  }

  return {
    apimartConfigured,
    apimartStatus,
    deepseekConfigured,
    deepseekStatus,
    refresh,
  };
}