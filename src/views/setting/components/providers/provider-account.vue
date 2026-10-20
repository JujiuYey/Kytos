<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RefreshCw } from '@lucide/vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SagStatusBadge } from '@/components/sag/status-badge';
import type {
  CredentialService,
  ProviderBalanceResult,
  ProviderModelsResult,
  ProviderUsageResult,
} from '@/types';
import { toErrorMessage } from '@/utils/helpers';
import UsageLineChart from './usage-line-chart.vue';

const props = defineProps<{
  // 凭据变化后由父组件递增，触发重新拉取
  refreshToken?: number;
  service: CredentialService;
}>();

// 缓存超过这个时长就在后台重新拉取
const STALE_AFTER_MS = 5 * 60 * 1000;
// 折叠时最多展示多少个模型
const COLLAPSED_MODEL_COUNT = 8;

const balanceResult = ref<ProviderBalanceResult | null>(null);
const modelsResult = ref<ProviderModelsResult | null>(null);
const usageResult = ref<ProviderUsageResult | null>(null);
const isRefreshingBalance = ref(false);
const isRefreshingModels = ref(false);
const isRefreshingUsage = ref(false);
const isExpanded = ref(false);

const isLoaded = computed(() =>
  Boolean(balanceResult.value && modelsResult.value && usageResult.value),
);
const isBalanceSupported = computed(() => balanceResult.value?.state !== 'unsupported');
const isModelsSupported = computed(() => modelsResult.value?.state !== 'unsupported');
const isUsageSupported = computed(() => usageResult.value?.state !== 'unsupported');
const isSupported = computed(
  () =>
    isLoaded.value &&
    (isBalanceSupported.value || isModelsSupported.value || isUsageSupported.value),
);
const balance = computed(() => balanceResult.value?.balance ?? null);
const balanceError = computed(() => balanceResult.value?.error ?? '');
const models = computed(() => modelsResult.value?.models ?? []);
const visibleModels = computed(() => models.value.slice(0, COLLAPSED_MODEL_COUNT));
const modelsError = computed(() => modelsResult.value?.error ?? '');
const usageTotal = computed(() => usageResult.value?.total ?? null);
const usageDays = computed(() => usageResult.value?.days ?? []);
const usageError = computed(() => usageResult.value?.error ?? '');
const isNotConfigured = computed(
  () =>
    balanceResult.value?.state === 'not-configured' ||
    modelsResult.value?.state === 'not-configured' ||
    usageResult.value?.state === 'not-configured',
);
const balanceUpdatedAtText = computed(() =>
  formatUpdatedAt(balanceResult.value?.fetchedAt ?? null),
);
const modelsUpdatedAtText = computed(() => formatUpdatedAt(modelsResult.value?.fetchedAt ?? null));
const usageUpdatedAtText = computed(() => formatUpdatedAt(usageResult.value?.fetchedAt ?? null));

async function load() {
  try {
    const [balance, models, usage] = await Promise.all([
      window.desktop.settings.getProviderBalance(props.service),
      window.desktop.settings.getProviderModels(props.service),
      window.desktop.settings.getProviderUsage(props.service),
    ]);
    balanceResult.value = balance;
    modelsResult.value = models;
    usageResult.value = usage;
  } catch (error: unknown) {
    const message = toErrorMessage(error);
    balanceResult.value = {
      balance: null,
      error: message,
      fetchedAt: null,
      service: props.service,
      state: 'error',
    };
    modelsResult.value = {
      error: message,
      fetchedAt: null,
      models: [],
      service: props.service,
      state: 'error',
    };
    usageResult.value = {
      days: [],
      error: message,
      fetchedAt: null,
      service: props.service,
      state: 'error',
      total: null,
    };
  }
}

async function refreshBalance() {
  if (isRefreshingBalance.value) {
    return;
  }
  isRefreshingBalance.value = true;
  try {
    balanceResult.value = await window.desktop.settings.refreshProviderBalance(props.service);
  } catch (error: unknown) {
    balanceResult.value = {
      balance: balanceResult.value?.balance ?? null,
      error: toErrorMessage(error),
      fetchedAt: balanceResult.value?.fetchedAt ?? null,
      service: props.service,
      state: 'error',
    };
  } finally {
    isRefreshingBalance.value = false;
  }
}

async function refreshModels() {
  if (isRefreshingModels.value) {
    return;
  }
  isRefreshingModels.value = true;
  try {
    modelsResult.value = await window.desktop.settings.refreshProviderModels(props.service);
  } catch (error: unknown) {
    modelsResult.value = {
      error: toErrorMessage(error),
      fetchedAt: modelsResult.value?.fetchedAt ?? null,
      models: modelsResult.value?.models ?? [],
      service: props.service,
      state: 'error',
    };
  } finally {
    isRefreshingModels.value = false;
  }
}

async function refreshUsage() {
  if (isRefreshingUsage.value) {
    return;
  }
  isRefreshingUsage.value = true;
  try {
    usageResult.value = await window.desktop.settings.refreshProviderUsage(props.service);
  } catch (error: unknown) {
    usageResult.value = {
      days: usageResult.value?.days ?? [],
      error: toErrorMessage(error),
      fetchedAt: usageResult.value?.fetchedAt ?? null,
      service: props.service,
      state: 'error',
      total: usageResult.value?.total ?? null,
    };
  } finally {
    isRefreshingUsage.value = false;
  }
}

function isStale(fetchedAt: string | null): boolean {
  if (!fetchedAt) {
    return true;
  }
  const time = new Date(fetchedAt).getTime();
  if (Number.isNaN(time)) {
    return true;
  }
  return Date.now() - time > STALE_AFTER_MS;
}

function formatUpdatedAt(fetchedAt: string | null): string {
  if (!fetchedAt) {
    return '';
  }
  const time = new Date(fetchedAt);
  if (Number.isNaN(time.getTime())) {
    return '';
  }
  // 不是当天的缓存要把日期也带上，否则「更新于 09:12」看不出是哪天
  const isToday = new Date().toDateString() === time.toDateString();
  return isToday
    ? time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : time.toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function formatAmount(amount: string, currency: string): string {
  const value = Number.parseFloat(amount);
  if (Number.isNaN(value)) {
    return amount;
  }
  if (currency === 'USD') {
    return `$${value.toFixed(2)}`;
  }
  if (currency === 'CNY') {
    return `¥${value.toFixed(2)}`;
  }
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 积分`;
}

function formatCredits(credits: number | null): string {
  if (credits === null) {
    return '—';
  }
  return `${credits.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 积分`;
}

function formatRequests(requests: number | null): string {
  if (requests === null) {
    return '';
  }
  return `${requests.toLocaleString('zh-CN')} 次`;
}

onMounted(async () => {
  await load();
  if (balanceResult.value?.state === 'ok' && isStale(balanceResult.value.fetchedAt)) {
    void refreshBalance();
  }
  if (modelsResult.value?.state === 'ok' && isStale(modelsResult.value.fetchedAt)) {
    void refreshModels();
  }
  if (usageResult.value?.state === 'ok' && isStale(usageResult.value.fetchedAt)) {
    void refreshUsage();
  }
});

watch(
  () => props.refreshToken,
  (token, previous) => {
    if (token && token !== previous) {
      void refreshBalance();
      void refreshModels();
      void refreshUsage();
    }
  },
);
</script>

<template>
  <div v-if="isSupported" class="border-t p-5">
    <h4 class="text-sm font-medium">账户</h4>

    <p v-if="isNotConfigured" class="mt-2 text-sm text-muted-foreground">
      {{
        isUsageSupported
          ? '配置 API Key 后可查看余额与用量。'
          : '配置 API Key 后可查看余额与可用模型。'
      }}
    </p>

    <template v-else>
      <div v-if="isBalanceSupported" class="mt-3 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-muted-foreground">余额</span>
            <template v-if="balance">
              <span v-if="balance.unlimited" class="text-sm font-medium">无限额度</span>
              <span v-else class="text-sm font-medium">
                {{ formatAmount(balance.total, balance.currency) }}
              </span>
              <SagStatusBadge v-if="!balance.unlimited && !balance.available" tone="warning">
                余额不足
              </SagStatusBadge>
            </template>
            <span v-else-if="isRefreshingBalance" class="text-sm text-muted-foreground">
              读取中…
            </span>
            <span v-else class="text-sm text-muted-foreground">—</span>
          </div>
          <div
            v-if="balance && (balance.granted || balance.toppedUp || balance.used)"
            class="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground"
          >
            <span v-if="balance.granted">
              赠金 {{ formatAmount(balance.granted, balance.currency) }}
            </span>
            <span v-if="balance.toppedUp">
              充值 {{ formatAmount(balance.toppedUp, balance.currency) }}
            </span>
            <span v-if="balance.used">已用 {{ formatAmount(balance.used, balance.currency) }}</span>
          </div>
          <p v-if="balanceError" class="mt-1 text-xs text-destructive">
            {{ balanceError }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <span v-if="balanceUpdatedAtText" class="text-xs text-muted-foreground">
            {{ balanceUpdatedAtText }}
          </span>
          <TooltipProvider :delay-duration="300">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7"
                  :disabled="isRefreshingBalance"
                  aria-label="刷新余额"
                  @click="refreshBalance"
                >
                  <RefreshCw class="size-3.5" :class="isRefreshingBalance ? 'animate-spin' : ''" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>刷新余额</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div v-if="isUsageSupported" class="mt-4 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-muted-foreground">用量</span>
          </div>
          <div v-if="usageTotal" class="mt-1.5">
            <div class="flex flex-wrap items-baseline gap-x-2">
              <span class="text-sm font-medium">{{ formatCredits(usageTotal.credits) }}</span>
              <span class="text-xs text-muted-foreground">
                近 30 天 · {{ formatRequests(usageTotal.requests) }}
              </span>
            </div>
            <UsageLineChart class="mt-2" :days="usageDays" />
          </div>
          <span v-else-if="isRefreshingUsage" class="mt-1.5 block text-sm text-muted-foreground">
            读取中…
          </span>
          <span v-else class="mt-1.5 block text-sm text-muted-foreground">暂无用量数据</span>
          <p v-if="usageError" class="mt-1 text-xs text-destructive">
            {{ usageError }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <span v-if="usageUpdatedAtText" class="text-xs text-muted-foreground">
            {{ usageUpdatedAtText }}
          </span>
          <TooltipProvider :delay-duration="300">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7"
                  :disabled="isRefreshingUsage"
                  aria-label="刷新用量"
                  @click="refreshUsage"
                >
                  <RefreshCw class="size-3.5" :class="isRefreshingUsage ? 'animate-spin' : ''" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>刷新用量</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div v-if="isModelsSupported" class="mt-4 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-muted-foreground">可用模型</span>
            <span v-if="models.length" class="text-xs text-muted-foreground">
              {{ models.length }} 个
            </span>
          </div>
          <div v-if="models.length && !isExpanded" class="mt-2 flex flex-wrap gap-1.5">
            <Badge
              v-for="model in visibleModels"
              :key="model"
              variant="outline"
              class="font-mono font-normal"
            >
              {{ model }}
            </Badge>
          </div>
          <ScrollArea v-else-if="isExpanded" class="mt-2 h-40">
            <div class="flex flex-wrap gap-1.5 pr-3">
              <Badge
                v-for="model in models"
                :key="model"
                variant="outline"
                class="font-mono font-normal"
              >
                {{ model }}
              </Badge>
            </div>
          </ScrollArea>
          <p v-else-if="!isRefreshingModels" class="mt-1 text-xs text-muted-foreground">
            暂无可用模型
          </p>
          <Button
            v-if="models.length > COLLAPSED_MODEL_COUNT"
            variant="ghost"
            size="sm"
            class="mt-1 h-7 px-2 text-xs"
            @click="isExpanded = !isExpanded"
          >
            {{ isExpanded ? '收起' : `展开全部 ${models.length} 个` }}
          </Button>
          <p v-if="modelsError" class="mt-1 text-xs text-destructive">
            {{ modelsError }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <span v-if="modelsUpdatedAtText" class="text-xs text-muted-foreground">
            {{ modelsUpdatedAtText }}
          </span>
          <TooltipProvider :delay-duration="300">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7"
                  :disabled="isRefreshingModels"
                  aria-label="刷新可用模型"
                  @click="refreshModels"
                >
                  <RefreshCw class="size-3.5" :class="isRefreshingModels ? 'animate-spin' : ''" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>刷新可用模型</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </template>
  </div>
</template>
