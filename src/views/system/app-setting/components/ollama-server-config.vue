<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, Save, RotateCcw, RefreshCw } from 'lucide-vue-next';
import { ollamaClient } from '@/services/ollama';
import { toast } from 'vue-sonner';
import { storeToRefs } from 'pinia';
import { useOllamaConfig } from '@/stores/ollama-config';
import type { OllamaServerConfig } from '@/types';

const ollamaStore = useOllamaConfig();
const { configs } = storeToRefs(ollamaStore);
const { updateConfigs, resetConfigs } = ollamaStore;

const isLoadingModels = ref(false);
const availableModels = ref<string[]>([]);
const isTestingConnection = ref(false);
const connectionStatus = ref<'idle' | 'success' | 'error'>('idle');

// 测试连接
async function testConnection() {
  isTestingConnection.value = true;
  connectionStatus.value = 'idle';

  try {
    // 临时设置URL进行测试
    ollamaClient.setBaseUrl(configs.value.ollamaUrl);
    const isConnected = await ollamaClient.testConnection();

    if (isConnected) {
      connectionStatus.value = 'success';
      toast.success('连接成功！');
      // 连接成功后加载模型列表
      await loadModels();
    } else {
      connectionStatus.value = 'error';
      toast.error('连接失败，请检查服务器地址');
    }
  } catch (error: unknown) {
    connectionStatus.value = 'error';
    const errorMessage = error instanceof Error ? error.message : '连接失败';
    toast.error(errorMessage);
  } finally {
    isTestingConnection.value = false;
  }
}

// 加载模型列表
async function loadModels() {
  isLoadingModels.value = true;
  try {
    ollamaClient.setBaseUrl(configs.value.ollamaUrl);
    const models = await ollamaClient.getModels();
    availableModels.value = models.models?.map(model => model.name) || [];
  } catch {
    toast.error('加载模型列表失败');
  } finally {
    isLoadingModels.value = false;
  }
}

function save() {
  const { isValid } = validateSettings(configs.value);
  if (!isValid) {
    toast.error('设置不正确');
    return;
  }

  updateConfigs(configs.value);
  toast.success('设置已保存');
}

async function reset() {
  resetConfigs();

  connectionStatus.value = 'idle';
  availableModels.value = [];

  toast.success('设置已重置为默认值');
}

// 验证设置
function validateSettings(settingsToValidate: Partial<OllamaServerConfig>) {
  const errors: string[] = [];

  // 验证 Ollama URL
  if (settingsToValidate.ollamaUrl) {
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(settingsToValidate.ollamaUrl)) {
      errors.push('Ollama 服务器地址格式不正确');
    }
  }

  // 验证温度值
  if (settingsToValidate.temperature !== undefined) {
    if (settingsToValidate.temperature < 0 || settingsToValidate.temperature > 2) {
      errors.push('温度值必须在 0-2 之间');
    }
  }

  // 验证最大令牌数
  if (settingsToValidate.maxTokens !== undefined) {
    if (settingsToValidate.maxTokens < 1 || settingsToValidate.maxTokens > 8192) {
      errors.push('最大令牌数必须在 1-8192 之间');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-lg">
        Ollama 服务器
      </CardTitle>
      <CardDescription>
        配置本地 Ollama 服务器连接
      </CardDescription>
    </CardHeader>

    <CardContent class="space-y-4">
      <div class="space-y-2">
        <Label for="ollama-url">服务器地址</Label>
        <div class="flex gap-2">
          <Input
            id="ollama-url"
            v-model="configs.ollamaUrl"
            placeholder="http://localhost:11434"
            class="flex-1"
          />
          <Button
            :disabled="isTestingConnection || !configs.ollamaUrl"
            variant="outline"
            @click="testConnection"
          >
            <Loader2 v-if="isTestingConnection" class="h-4 w-4 animate-spin" />
            <template v-else>
              测试连接
            </template>
          </Button>
        </div>

        <!-- 连接状态 -->
        <div v-if="connectionStatus !== 'idle'" class="flex items-center gap-2 text-sm">
          <template v-if="connectionStatus === 'success'">
            <CheckCircle class="h-4 w-4 text-green-500" />
            <span class="text-green-600">连接成功</span>
          </template>
          <template v-else>
            <XCircle class="h-4 w-4 text-red-500" />
            <span class="text-red-600">连接失败</span>
          </template>
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label for="model-select">选择模型</Label>
          <Button
            :disabled="isLoadingModels || !configs.ollamaUrl"
            variant="ghost"
            size="sm"
            @click="loadModels"
          >
            <Loader2 v-if="isLoadingModels" class="h-4 w-4 animate-spin" />
            <RefreshCw v-else class="h-4 w-4" />
          </Button>
        </div>

        <Select v-model="configs.selectedModel">
          <SelectTrigger>
            <SelectValue placeholder="请选择模型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-if="availableModels.length === 0" value="no-models" disabled>
              {{ isLoadingModels ? '加载中...' : '无可用模型' }}
            </SelectItem>
            <SelectItem
              v-for="model of availableModels"
              v-else
              :key="model"
              :value="model"
            >
              {{ model }}
              <Badge v-if="model.includes('deepseek-r1')" variant="secondary" class="ml-2">
                推荐
              </Badge>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label for="temperature">温度 ({{ configs.temperature }})</Label>
          <input
            id="temperature"
            v-model.number="configs.temperature"
            type="range"
            min="0"
            max="2"
            step="0.1"
            class="w-full"
          />
          <p class="text-xs text-muted-foreground">
            控制回复的随机性，值越高越随机
          </p>
        </div>

        <div class="space-y-2">
          <Label for="max-tokens">最大令牌数</Label>
          <Input
            id="max-tokens"
            v-model.number="configs.maxTokens"
            type="number"
            min="1"
            max="8192"
          />
          <p class="text-xs text-muted-foreground">
            限制回复的最大长度
          </p>
        </div>
      </div>

      <div class="space-y-2">
        <Label for="system-prompt">系统提示词</Label>

        <textarea
          id="system-prompt"
          v-model="configs.systemPrompt"
          class="w-full min-h-[80px] px-3 py-2 border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none rounded-md"
          placeholder="输入系统提示词..."
        />
        <p class="text-xs text-muted-foreground">
          定义 AI 助手的角色和行为
        </p>
      </div>
    </CardContent>

    <CardFooter class="flex justify-between">
      <Button variant="outline" @click="reset">
        <RotateCcw class="h-4 w-4 mr-2" />
        重置默认
      </Button>
      <Button @click="save">
        <Save class="h-4 w-4 mr-2" />
        保存设置
      </Button>
    </CardFooter>
  </Card>
</template>
