import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import type { CredentialStatus } from '@/types';

export interface CredentialStatusBundle {
  deepseekStatus: Ref<CredentialStatus | null>;
  apimartStatus: Ref<CredentialStatus | null>;
  minimaxStatus: Ref<CredentialStatus | null>;
  deepseekConfigured: ComputedRef<boolean>;
  apimartConfigured: ComputedRef<boolean>;
  minimaxConfigured: ComputedRef<boolean>;
  refresh: () => Promise<void>;
}

export function useCredentialStatus(): CredentialStatusBundle {
  const deepseekStatus = ref<CredentialStatus | null>(null);
  const apimartStatus = ref<CredentialStatus | null>(null);
  const minimaxStatus = ref<CredentialStatus | null>(null);

  const deepseekConfigured = computed(() => Boolean(deepseekStatus.value?.configured));
  const apimartConfigured = computed(() => Boolean(apimartStatus.value?.configured));
  const minimaxConfigured = computed(() => Boolean(minimaxStatus.value?.configured));

  async function refresh(): Promise<void> {
    const [deepseek, apimart, minimax] = await Promise.all([
      window.desktop.settings.getCredentialStatus('deepseek'),
      window.desktop.settings.getCredentialStatus('apimart'),
      window.desktop.settings.getCredentialStatus('minimax'),
    ]);
    deepseekStatus.value = deepseek;
    apimartStatus.value = apimart;
    minimaxStatus.value = minimax;
  }

  return {
    apimartConfigured,
    apimartStatus,
    deepseekConfigured,
    deepseekStatus,
    minimaxConfigured,
    minimaxStatus,
    refresh,
  };
}
