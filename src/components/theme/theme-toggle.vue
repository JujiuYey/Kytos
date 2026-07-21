<script setup lang="ts">
import { Monitor, Moon, Sun } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/composables/use-theme';

const { setTheme, theme } = useTheme();

const themeOptions = [
  { icon: Sun, label: '浅色', value: 'light' },
  { icon: Moon, label: '深色', value: 'dark' },
  { icon: Monitor, label: '跟随系统', value: 'system' },
] as const;
</script>

<template>
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
</template>
