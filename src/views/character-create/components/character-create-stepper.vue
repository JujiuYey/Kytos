<script setup lang="ts">
import { Check } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { CHARACTER_WORKFLOW_STEPS, type Step } from '../workflow-data';

defineProps<{
  currentStep: Step;
  furthestStep: Step;
}>();

const emit = defineEmits<{
  (event: 'select', step: Step): void;
}>();
</script>

<template>
  <nav aria-label="创建角色步骤">
    <ol class="mx-auto flex w-full max-w-3xl items-center">
      <li
        v-for="step in CHARACTER_WORKFLOW_STEPS"
        :key="step.number"
        class="flex min-w-0 flex-1 items-center last:flex-none"
      >
        <Button
          variant="ghost"
          class="h-auto shrink-0 gap-2 rounded-md px-1.5 py-1.5 sm:px-2"
          :disabled="step.number > furthestStep"
          @click="emit('select', step.number)"
        >
          <span
            :class="[
              'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
              step.number < currentStep
                ? 'border-primary bg-primary text-primary-foreground'
                : step.number === currentStep
                  ? 'border-primary text-primary'
                  : 'border-border bg-background text-muted-foreground',
            ]"
          >
            <Check v-if="step.number < currentStep" class="size-3.5" />
            <span v-else>{{ step.number }}</span>
          </span>
          <span
            :class="[
              'hidden text-xs sm:block',
              step.number === currentStep ? 'font-medium text-foreground' : 'text-muted-foreground',
            ]"
          >
            {{ step.label }}
          </span>
        </Button>
        <span
          v-if="step.number < 4"
          :class="[
            'mx-2 h-px min-w-3 flex-1 bg-border sm:mx-4',
            step.number < currentStep && 'bg-primary',
          ]"
          aria-hidden="true"
        />
      </li>
    </ol>
  </nav>
</template>
