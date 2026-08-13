<script setup lang="ts">
import { computed } from 'vue';
import {
  Check,
  CircleUserRound,
  PanelsTopLeft,
  PersonStanding,
  Rotate3D,
  ScanFace,
  UserRound,
  WandSparkles,
  X,
} from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  CharacterAnchorBinding,
  CharacterVisualImage,
  CharacterVisualResolution,
  CharacterVisualAssetSelection,
} from '@/types';

export type GeneratedAnchorRole = Exclude<
  CharacterAnchorBinding['role'],
  'unassigned' | 'standard'
>;

interface ReferenceOption {
  image: CharacterVisualImage;
  label: string;
  selection: CharacterVisualAssetSelection;
}

interface Props {
  busy: boolean;
  disabled: boolean;
  filledRoles: CharacterAnchorBinding['role'][];
  reference: ReferenceOption | undefined;
  resolution: CharacterVisualResolution;
  selectedRoles: GeneratedAnchorRole[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'generate'): void;
  (event: 'update:resolution', value: CharacterVisualResolution): void;
  (event: 'update:selectedRoles', value: GeneratedAnchorRole[]): void;
}>();

const anchorPresets = [
  {
    description: '正面、3/4、侧面、背面与脸部特写整齐排布',
    icon: PanelsTopLeft,
    label: '角色转面图',
    role: 'turnaround',
  },
  {
    description: '锁定脸型、五官、发型轮廓与配饰细节',
    icon: ScanFace,
    label: '脸部与发型',
    role: 'face',
  },
  {
    description: '从头到脚呈现体型、服装、鞋子与配饰',
    icon: PersonStanding,
    label: '全身与服装',
    role: 'full-body',
  },
  {
    description: '补充脸部立体关系与身体透视',
    icon: UserRound,
    label: '四分之三视角',
    role: 'three-quarter',
  },
  {
    description: '锁定鼻梁、下颌、头型与身体侧面轮廓',
    icon: CircleUserRound,
    label: '侧面视角',
    role: 'side',
  },
  {
    description: '锁定后脑发型、服装背面与整体比例',
    icon: Rotate3D,
    label: '背面视角',
    role: 'back',
  },
] as const satisfies readonly {
  description: string;
  icon: typeof PanelsTopLeft;
  label: string;
  role: GeneratedAnchorRole;
}[];

const selectedCount = computed(() => props.selectedRoles.length);
const missingRoles = computed(() =>
  anchorPresets.filter(item => !props.filledRoles.includes(item.role)).map(item => item.role),
);

function isSelected(role: GeneratedAnchorRole): boolean {
  return props.selectedRoles.includes(role);
}

function toggleRole(role: GeneratedAnchorRole, selected: boolean): void {
  emit(
    'update:selectedRoles',
    selected
      ? [...new Set([...props.selectedRoles, role])]
      : props.selectedRoles.filter(item => item !== role),
  );
}

function selectMissing(): void {
  emit('update:selectedRoles', missingRoles.value);
}
</script>

<template>
  <section class="flex min-h-0 flex-col" aria-label="角色锚点生成设置">
    <div class="flex h-12 shrink-0 items-center justify-between border-b px-4">
      <div class="flex items-center gap-2">
        <PanelsTopLeft class="size-4 text-primary" />
        <h2 class="text-sm font-medium">生成角色锚点</h2>
      </div>
      <Button variant="ghost" size="icon" aria-label="关闭生成面板" @click="emit('close')">
        <X class="size-4" />
      </Button>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div class="space-y-6 px-5 py-5">
        <section aria-labelledby="anchor-source-heading">
          <div class="mb-3">
            <h2 id="anchor-source-heading" class="text-sm font-medium">身份基准</h2>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">
              所有锚点都从同一张标准参考图生成，只改变视角和取景。
            </p>
          </div>
          <div v-if="reference" class="flex items-center gap-3 rounded-md border bg-muted/15 p-2">
            <AiImage
              :alt="reference.label"
              :src="reference.image.url"
              class="size-20 shrink-0 rounded-sm bg-background object-contain"
            />
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ reference.label }}</p>
              <p class="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Check class="size-3.5 text-primary" />
                标准参考图
              </p>
            </div>
          </div>
          <div
            v-else
            class="flex min-h-24 items-center justify-center rounded-md border border-dashed px-3 text-center text-xs leading-5 text-muted-foreground"
          >
            请先上传一张标准参考图
          </div>
        </section>

        <section aria-labelledby="anchor-presets-heading">
          <div class="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="anchor-presets-heading" class="text-sm font-medium">生成内容</h2>
              <p class="mt-1 text-xs leading-5 text-muted-foreground">
                已默认选择当前缺失的锚点，每项生成 1 张。
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              :disabled="busy || !missingRoles.length"
              @click="selectMissing"
            >
              选择缺失项
            </Button>
          </div>

          <div class="space-y-2">
            <label
              v-for="item in anchorPresets"
              :key="item.role"
              :class="[
                'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-3 transition-colors hover:bg-muted/30',
                isSelected(item.role) && 'border-primary/40 bg-primary/5',
              ]"
            >
              <Checkbox
                class="mt-0.5"
                :disabled="busy"
                :model-value="isSelected(item.role)"
                @update:model-value="toggleRole(item.role, Boolean($event))"
              />
              <component :is="item.icon" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span class="min-w-0 flex-1">
                <span class="flex items-center justify-between gap-2 text-sm font-medium">
                  {{ item.label }}
                  <span
                    v-if="filledRoles.includes(item.role)"
                    class="shrink-0 text-xs font-normal text-muted-foreground"
                  >
                    已有
                  </span>
                </span>
                <span class="mt-1 block text-xs leading-5 text-muted-foreground">
                  {{ item.description }}
                </span>
              </span>
            </label>
          </div>
        </section>

        <section aria-labelledby="anchor-output-heading">
          <h2 id="anchor-output-heading" class="mb-3 text-sm font-medium">输出规格</h2>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label>比例</Label>
              <div class="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm">
                按锚点设置
              </div>
            </div>
            <div class="space-y-2">
              <Label for="character-anchor-resolution">清晰度</Label>
              <Select
                :model-value="resolution"
                :disabled="busy"
                @update:model-value="emit('update:resolution', $event as CharacterVisualResolution)"
              >
                <SelectTrigger id="character-anchor-resolution" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1k">1K</SelectItem>
                  <SelectItem value="2k">2K</SelectItem>
                  <SelectItem value="4k">4K</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
      </div>
    </ScrollArea>

    <footer class="shrink-0 border-t bg-background px-5 py-4">
      <Button class="w-full" :disabled="disabled" @click="emit('generate')">
        <WandSparkles class="size-4" />
        {{ busy ? '正在提交锚点任务' : `生成 ${selectedCount} 个角色锚点` }}
      </Button>
      <p class="mt-2 text-center text-xs text-muted-foreground">
        将提交 {{ selectedCount }} 个生图任务，完成后自动归入对应职责
      </p>
    </footer>
  </section>
</template>
