<script setup lang="ts">
import { Sparkles } from '@lucide/vue';
import { IllustrationCanvasWorkflow } from './components/illustration-canvas-workflow';
import { SagPage } from '@/components/sag/sag-page';
</script>

<template>
  <SagPage title="插画创作 Beta" description="通过节点画布编排参考图与生成" :icon="Sparkles">
    <IllustrationCanvasWorkflow class="min-h-0 min-w-0 flex-1" />
  </SagPage>
</template>
