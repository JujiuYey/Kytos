<script setup lang="ts">
import { IllustrationCanvasWorkflow } from './components/illustration-canvas-workflow';
import { SagPage } from '@/components/sag/sag-page';
import IllustrationBetaHeader from './components/illustration-beta-header.vue';
</script>

<template>
  <SagPage>
    <template #header>
      <IllustrationBetaHeader />
    </template>
    <IllustrationCanvasWorkflow class="min-h-0 min-w-0 flex-1" />
  </SagPage>
</template>
