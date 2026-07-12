import { inject, provide, ref, computed, unref } from 'vue';
import type { InjectionKey, Ref } from 'vue';

// 定义注入的键
const projectInjectionKey: InjectionKey<{
  projectId: Ref<string | undefined>;
  bridgeId: Ref<string | undefined>;
}> = Symbol('projectContext');

// 提供者
export function useProjectProvider(
  projectId: Ref<string | undefined>,
  bridgeId: Ref<string | undefined>,
) {
  const context = {
    projectId,
    bridgeId,
  };
  provide(projectInjectionKey, context);
  return context;
}

export function useProjectContext() {
  const context = inject(projectInjectionKey, {
    projectId: ref(undefined),
    bridgeId: ref(undefined),
  });

  return reactive({
    projectId: computed(() => unref(context.projectId)),
    bridgeId: computed(() => unref(context.bridgeId)),
  });
}
