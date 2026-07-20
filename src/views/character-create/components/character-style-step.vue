<script setup lang="ts">
import { Check } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { CHARACTER_STYLES, type StyleId } from '../workflow-data';

defineProps<{
  modelValue: StyleId | null;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: StyleId | null): void;
}>();
</script>

<template>
  <section aria-labelledby="style-heading">
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <h3 id="style-heading" class="text-sm font-medium">选择一个起点</h3>
        <p class="mt-1 text-xs text-muted-foreground">先选感觉，不确定也可以直接下一步</p>
      </div>
      <span class="text-xs text-muted-foreground">
        {{ CHARACTER_STYLES.find(style => style.id === modelValue)?.name || '可跳过' }}
      </span>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Button
        v-for="(style, index) in CHARACTER_STYLES"
        :key="style.id"
        variant="ghost"
        class="group h-auto min-h-0 items-stretch justify-start whitespace-normal rounded-lg border bg-background p-0 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-background hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
        :class="modelValue === style.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'"
        :aria-pressed="modelValue === style.id"
        @click="emit('update:modelValue', modelValue === style.id ? null : style.id)"
      >
        <article class="flex w-full min-w-0 flex-col">
          <div class="relative aspect-square overflow-hidden rounded-t-lg border-b bg-muted/20">
            <img
              :src="style.image"
              :alt="`${style.name}风格示例`"
              class="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
            <span class="absolute left-4 top-3 text-[10px] font-semibold opacity-60">
              0{{ index + 1 }}
            </span>
            <span
              v-if="modelValue === style.id"
              class="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check class="size-3.5" />
            </span>
          </div>
          <div class="flex flex-1 flex-col p-4">
            <h4 class="text-base font-semibold text-foreground">{{ style.name }}</h4>
            <p class="mt-0.5 text-xs font-medium text-muted-foreground">{{ style.subtitle }}</p>
            <p class="mt-3 text-xs leading-5 text-muted-foreground">{{ style.description }}</p>
            <div class="mt-4 flex flex-wrap gap-1.5">
              <span
                v-for="tag in style.tags"
                :key="tag"
                class="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </article>
      </Button>
    </div>
  </section>
</template>
