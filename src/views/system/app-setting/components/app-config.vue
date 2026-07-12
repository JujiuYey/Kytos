<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Trash2, Save, RotateCcw } from 'lucide-vue-next';
import ThemeToggle from '@/components/theme/theme-toggle.vue';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { useConversationsStore } from '@/stores/conversations';
import { toast } from 'vue-sonner';
import { open } from '@tauri-apps/plugin-dialog';

const appStore = useAppStore();
const { settings } = storeToRefs(appStore);
const { updateSettings, resetSettings } = appStore;

function save() {
  updateSettings(settings.value);
}

function reset() {
  resetSettings();
}

const showClearConfirm = ref(false);
const { clearConversations } = useConversationsStore();

// 清除所有对话
async function handleClearAllConversations() {
  clearConversations();
  showClearConfirm.value = false;
  toast.success('所有对话已清除');
}
function handleCancel() {
  showClearConfirm.value = false;
}
function openClearConfirm() {
  showClearConfirm.value = true;
}

// 选择文件夹路径
async function selectPath() {
  try {
    const selected = await open({
      directory: true,
      defaultPath: '',
      title: '选择仓库路径',
      multiple: false,
    });

    if (selected) {
      settings.value.storagePath = selected;
    }
  } catch (error) {
    toast.error(`选择文件夹失败: ${error}`);
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-lg">
        应用设置
      </CardTitle>
      <CardDescription>
        个性化应用体验
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="space-y-0.5">
          <Label>自动保存对话</Label>
          <p class="text-sm text-muted-foreground">
            自动保存对话历史到本地存储
          </p>
        </div>
        <Switch v-model="settings.autoSave" />
      </div>

      <div class="flex items-center justify-between">
        <div class="space-y-0.5">
          <Label>清除数据</Label>
          <p class="text-sm text-muted-foreground">
            删除所有对话记录，此操作不可撤销
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          @click="openClearConfirm"
        >
          <Trash2 class="h-4 w-4 mr-2" />
          清除所有对话
        </Button>
      </div>

      <Separator />

      <div class="space-y-2">
        <Label for="path">存储路径</Label>
        <p class="text-sm text-muted-foreground">
          文件/图片上传和生成文件等操作的存储路径
        </p>
        <div class="flex gap-2">
          <Input
            id="path"
            v-model="settings.storagePath"
            placeholder="选择或输入存储路径"
            class="flex-1"
          />
          <Button variant="outline" @click="selectPath">
            选择文件夹
          </Button>
        </div>
      </div>

      <Separator />

      <div class="flex items-center justify-between">
        <div class="space-y-0.5">
          <Label>主题设置</Label>
          <p class="text-sm text-muted-foreground">
            选择应用主题外观
          </p>
        </div>
        <ThemeToggle />
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

    <Dialog :open="showClearConfirm" @update:open="handleCancel">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>确认清除</DialogTitle>
          <DialogDescription>
            你确定要清除所有对话记录吗？此操作不可撤销，所有聊天历史将被永久删除。
          </DialogDescription>
        </DialogHeader>
        <div class="flex justify-end gap-2 pt-4">
          <Button variant="outline" @click="handleCancel">
            取消
          </Button>
          <Button variant="destructive" @click="handleClearAllConversations">
            <Trash2 class="h-4 w-4 mr-2" />
            确认清除
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </Card>
</template>
