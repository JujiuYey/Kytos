<script lang="ts" setup>
// 报告生成页面
import { generateDocx } from './test-generation-1';
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">
      报告生成
    </h1>
    <div class="bg-card p-6 rounded-lg shadow">
      <p>这是报告生成页面</p>

      <Button @click="generateDocx">
        测试按钮
      </Button>
    </div>
  </div>
</template>
