<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { toast } from 'vue-sonner';
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Save,
  ShieldAlert,
  Trash2,
} from 'lucide-vue-next';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CredentialService, CredentialStatus } from '@/types';

interface Props {
  description: string;
  docsUrl: string;
  placeholder: string;
  service: CredentialService;
  title: string;
}

const props = defineProps<Props>();

const apiKey = ref('');
const errorMessage = ref('');
const isClearing = ref(false);
const isClearDialogOpen = ref(false);
const isLoading = ref(true);
const isSaving = ref(false);
const isVisible = ref(false);
const status = ref<CredentialStatus | null>(null);

const canSave = computed(
  () => Boolean(apiKey.value.trim()) && status.value?.secureStorageAvailable && !isSaving.value,
);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function refreshStatus() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    status.value = await window.desktop.getCredentialStatus(props.service);
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
}

async function saveCredential() {
  if (!canSave.value) {
    return;
  }

  isSaving.value = true;
  errorMessage.value = '';
  try {
    status.value = await window.desktop.setCredential({
      service: props.service,
      value: apiKey.value.trim(),
    });
    apiKey.value = '';
    isVisible.value = false;
    toast.success(`${props.title} 已安全保存`);
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isSaving.value = false;
  }
}

async function clearCredential() {
  isClearing.value = true;
  errorMessage.value = '';
  try {
    status.value = await window.desktop.deleteCredential(props.service);
    isClearDialogOpen.value = false;
    toast.success(`${props.title} 已清除`);
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isClearing.value = false;
  }
}

onMounted(() => {
  void refreshStatus();
});
</script>

<template>
  <div class="p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <KeyRound class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-medium">{{ title }}</h3>
          <Badge v-if="isLoading" variant="outline">读取中</Badge>
          <Badge v-else-if="status?.configured" variant="secondary">
            <CheckCircle2 class="size-3" />
            已配置
          </Badge>
          <Badge v-else variant="outline">未配置</Badge>
        </div>
        <p class="mt-1.5 text-sm leading-5 text-muted-foreground">
          {{ description }}
        </p>
      </div>

      <Button
        as="a"
        :href="docsUrl"
        target="_blank"
        rel="noopener noreferrer"
        variant="ghost"
        size="sm"
      >
        服务平台
        <ExternalLink class="size-3.5" />
      </Button>
    </div>

    <Alert v-if="status && !status.secureStorageAvailable" variant="destructive" class="mt-4">
      <ShieldAlert class="size-4" />
      <AlertTitle>系统安全存储不可用</AlertTitle>
      <AlertDescription>当前系统无法提供凭据加密，因此不会保存 API Key。</AlertDescription>
    </Alert>

    <Alert v-if="errorMessage" variant="destructive" class="mt-4">
      <ShieldAlert class="size-4" />
      <AlertTitle>操作失败</AlertTitle>
      <AlertDescription>{{ errorMessage }}</AlertDescription>
    </Alert>

    <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <div class="min-w-0 flex-1 space-y-2">
        <Label :for="`${service}-api-key`">API Key</Label>
        <div class="relative">
          <Input
            :id="`${service}-api-key`"
            v-model="apiKey"
            :type="isVisible ? 'text' : 'password'"
            :placeholder="status?.configured ? '输入新 Key 以替换当前凭据' : placeholder"
            autocomplete="new-password"
            class="pr-10 font-mono"
            :disabled="isLoading || !status?.secureStorageAvailable"
            @keydown.enter="saveCredential"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="absolute right-0 top-0 size-9"
            :disabled="!apiKey"
            :aria-label="isVisible ? '隐藏 API Key' : '显示 API Key'"
            @click="isVisible = !isVisible"
          >
            <EyeOff v-if="isVisible" class="size-4" />
            <Eye v-else class="size-4" />
          </Button>
        </div>
      </div>

      <div class="flex shrink-0 gap-2">
        <Button :disabled="!canSave" @click="saveCredential">
          <Loader2 v-if="isSaving" class="size-4 animate-spin" />
          <Save v-else class="size-4" />
          {{ status?.configured ? '替换 Key' : '保存 Key' }}
        </Button>
        <Button
          v-if="status?.configured"
          variant="outline"
          aria-label="清除已保存的 API Key"
          @click="isClearDialogOpen = true"
        >
          <Trash2 class="size-4" />
          清除
        </Button>
      </div>
    </div>

    <Dialog v-model:open="isClearDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>清除 {{ title }}？</DialogTitle>
          <DialogDescription>
            加密保存的凭据将从本机删除。之后调用该服务前需要重新配置。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="isClearing" @click="isClearDialogOpen = false">
            取消
          </Button>
          <Button variant="destructive" :disabled="isClearing" @click="clearCredential">
            <Loader2 v-if="isClearing" class="size-4 animate-spin" />
            <Trash2 v-else class="size-4" />
            清除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
