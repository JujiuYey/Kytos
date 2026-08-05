<script setup lang="ts">
import { Monitor, Moon, Sun } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/composables/use-theme';
import { computed } from 'vue';

const { setTheme, theme } = useTheme();

const themeOptions = [
  { icon: Sun, label: '浅色', value: 'light' },
  { icon: Moon, label: '深色', value: 'dark' },
  { icon: Monitor, label: '跟随系统', value: 'system' },
] as const;

const themeLabel = computed(() => {
  return themeOptions.find((option) => option.value === theme.value)?.label;
});
</script>

<template>
  <section aria-labelledby="appearance-heading">
    <div class="mb-4">
      <h2 id="appearance-heading" class="text-base font-semibold">外观</h2>
      <p class="mt-1 text-sm text-muted-foreground">选择应用使用的界面主题。</p>
    </div>
    <div class="flex items-center justify-between gap-4 rounded-md border p-5">
      <div class="min-w-0">
        <h3 class="text-sm font-medium">界面主题</h3>
        <p class="mt-1 text-sm text-muted-foreground">当前：{{ themeLabel }}</p>
      </div>
      <TooltipProvider :delay-duration="300">
        <div
          class="inline-flex items-center gap-1 rounded-md border bg-muted/40 p-1"
          role="group"
          aria-label="界面主题"
        >
          <Tooltip v-for="option in themeOptions" :key="option.value">
            <TooltipTrigger as-child>
              <Button
                type="button"
                size="icon-sm"
                :variant="theme === option.value ? 'secondary' : 'ghost'"
                :aria-label="option.label"
                :aria-pressed="theme === option.value"
                @click="setTheme(option.value)"
              >
                <component :is="option.icon" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ option.label }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  </section>
</template>
