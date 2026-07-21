<script setup lang="ts">
import Error from '@/components/custom-error.vue';
</script>

<template>
  <div class="flex items-center justify-center h-screen">
    <Error
      :code="404"
      subtitle="页面未找到"
      error="您访问的页面可能已被移除、更名或暂时无法访问。"
    />
  </div>
</template>