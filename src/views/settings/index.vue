<script setup lang="ts">
import ProjectDir from './components/project-dir.vue';
import ApimartKey from './components/apimart-key.vue';
import DeepseekKey from './components/deepseek-key.vue';
import DeepseekModel from './components/deepseek-model.vue';
import { Separator } from '@/components/ui/separator';
</script>

<template>
  <main class="h-full overflow-y-auto">
    <div class="mx-auto w-full max-w-3xl px-6 py-8 lg:py-10">
      <header>
        <h1 class="text-2xl font-semibold">系统设置</h1>
        <p class="mt-1.5 text-sm text-muted-foreground">管理本地作品目录和外部模型服务凭据。</p>
      </header>

      <section aria-labelledby="workspace-heading" class="mt-10">
        <div class="mb-4">
          <h2 id="workspace-heading" class="text-base font-semibold">作品工作区</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            素材和生成结果保存在这里。切换目录不会搬迁已有文件。
          </p>
        </div>
        <ProjectDir />
      </section>

      <Separator class="my-10" />

      <section aria-labelledby="credentials-heading">
        <div class="mb-4">
          <h2 id="credentials-heading" class="text-base font-semibold">模型与凭据</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            API Key 使用系统凭据保护机制加密，只保存在这台设备的应用数据目录中。
          </p>
        </div>

        <div class="divide-y rounded-md border">
          <DeepseekKey />
          <DeepseekModel />
          <ApimartKey />
        </div>
      </section>
    </div>
  </main>
</template>
