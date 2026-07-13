# views/index.vue Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `views/settings/index.vue` (221 → ~30 lines) and `views/writer/index.vue` (240 → ~70 lines) into co-located `components/` subcomponents, matching the existing `views/gacha/` pattern.

**Architecture:** Each section/pane component owns its refs, watchers, and async handlers. `index.vue` becomes a pure orchestrator — container, page-level guards, cross-component handlers. Zero new abstractions (no composables, no shared `ApiKeySection`, no store changes). Communication between sibling sections happens indirectly via the existing Pinia stores, not via props/emits chains.

**Tech Stack:** Vue 3 `<script setup lang="ts">` · Pinia stores (`useGachaStore`, `useAppStore`, `useWriterStore`) · Tauri 2 `invoke()` + `@tauri-apps/plugin-dialog` `open()` · `lucide-vue-next` icons · Tailwind v4 utility classes · ESLint (`@antfu/eslint-config`) · `vue-tsc` for typecheck.

**Spec:** `docs/superpowers/specs/2026-07-13-views-index-split-design.md`

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `src/views/settings/index.vue` | Rewrite | Orchestrator: 4 section tags + container |
| `src/views/settings/components/project-dir.vue` | Create | Project dir picker (button + readonly Input) |
| `src/views/settings/components/apimart-key.vue` | Create | APIMart key input, status display, save handler, watches `projectRoot` |
| `src/views/settings/components/deepseek-key.vue` | Create | DeepSeek key input, status display, save handler (re-scans on save), watches `projectRoot` |
| `src/views/settings/components/deepseek-model.vue` | Create | Model `Select` bound to `app.settings.deepseekModel` |
| `src/views/writer/index.vue` | Rewrite | Orchestrator: empty/scan guards + ResizablePanelGroup + 2 panes + `onMounted` |
| `src/views/writer/components/form-pane.vue` | Create | Left: category / name / size / resolution / intent / generate button |
| `src/views/writer/components/draft-pane.vue` | Create | Right: header / reasoning details / draft textarea / error footer |

Untouched: `src/views/{character,strategy,gacha}/index.vue`, all stores, all types, all utils.

---

## Task 1: Extract `settings/components/project-dir.vue`

**Files:**
- Create: `src/views/settings/components/project-dir.vue`
- Verify: `pnpm lint:eslint` (no test framework in this project)

- [ ] **Step 1: Create the components directory**

```bash
mkdir -p src/views/settings/components
```

- [ ] **Step 2: Write `project-dir.vue`**

The picker mutates `store.projectRoot`. Other sections react to that mutation via their own watchers (Tasks 2 and 3), so this component does NOT call refresh helpers directly.

```vue
<script setup lang="ts">
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen } from 'lucide-vue-next';
import { useGachaStore } from '@/stores/gacha';

const store = useGachaStore();

async function chooseProjectDir() {
  const selected = await open({ directory: true, multiple: false });
  if (typeof selected === 'string') {
    store.projectRoot = selected;
    await store.scanProject();
  }
}
</script>

<template>
  <section class="space-y-3">
    <h2 class="text-sm font-medium text-muted-foreground">
      项目目录
    </h2>
    <div class="flex gap-2">
      <Input
        :model-value="store.projectRoot"
        placeholder="选一个项目根目录（一般是 ~/Desktop/角色抽卡）"
        readonly
        class="flex-1 font-mono text-sm"
      />
      <Button variant="outline" @click="chooseProjectDir">
        <FolderOpen class="size-4" />
        浏览
      </Button>
    </div>
    <p class="text-xs text-muted-foreground">
      类目从目录里扫出来（含 <code>prompt/</code> 的子目录就算一个类目）。
    </p>
  </section>
</template>
```

- [ ] **Step 3: Run lint**

Run: `pnpm lint:eslint`
Expected: passes (file follows existing project conventions).

- [ ] **Step 4: Commit**

```bash
git add src/views/settings/components/project-dir.vue
git commit -m "refactor(settings): extract project-dir section"
```

---

## Task 2: Extract `settings/components/apimart-key.vue`

**Files:**
- Create: `src/views/settings/components/apimart-key.vue`

- [ ] **Step 1: Write `apimart-key.vue`**

Self-contained: owns `apiKeyInput` / `apiKeyMasked` / `apiKeyStatus` / `isSavingApimart`. Watches `store.projectRoot` to refresh status on mount and on directory change.

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { Key, Loader2, Save } from 'lucide-vue-next';
import { useGachaStore } from '@/stores/gacha';

const store = useGachaStore();

const apiKeyInput = ref('');
const apiKeyMasked = ref('');
const apiKeyStatus = ref<'unknown' | 'set' | 'unset'>('unknown');
const isSavingApimart = ref(false);

async function refreshApimartStatus() {
  if (!store.projectRoot) {
    apiKeyStatus.value = 'unknown';
    return;
  }
  const key = await invoke<string | null>('read_api_key', { root: store.projectRoot });
  apiKeyStatus.value = key ? 'set' : 'unset';
  apiKeyMasked.value = key ? `sk-****${key.slice(-4)}` : '';
}

async function saveApimartKey() {
  if (!store.projectRoot || !apiKeyInput.value.trim()) {
    return;
  }
  isSavingApimart.value = true;
  try {
    await invoke('write_api_key', { root: store.projectRoot, key: apiKeyInput.value.trim() });
    apiKeyInput.value = '';
    await refreshApimartStatus();
  } finally {
    isSavingApimart.value = false;
  }
}

const canSaveApimart = computed(() => Boolean(store.projectRoot) && apiKeyInput.value.trim().length > 0);

watch(
  () => store.projectRoot,
  async () => {
    await refreshApimartStatus();
  },
  { immediate: true },
);
</script>

<template>
  <section class="space-y-3">
    <h2 class="text-sm font-medium text-muted-foreground">
      APIMart key（画图用）
    </h2>
    <p v-if="!store.projectRoot" class="text-xs text-muted-foreground">
      先设置项目目录。
    </p>
    <template v-else>
      <div class="text-xs">
        <span class="text-muted-foreground">当前：</span>
        <span v-if="apiKeyStatus === 'set'" class="font-mono">{{ apiKeyMasked }}</span>
        <span v-else-if="apiKeyStatus === 'unset'" class="text-red-600">未配置</span>
        <span v-else class="text-muted-foreground">读取中…</span>
      </div>
      <div class="flex gap-2">
        <Input
          v-model="apiKeyInput"
          type="password"
          placeholder="sk-..."
          class="flex-1 font-mono text-sm"
        />
        <Button :disabled="!canSaveApimart || isSavingApimart" @click="saveApimartKey">
          <Loader2 v-if="isSavingApimart" class="size-4 animate-spin" />
          <Save v-else class="size-4" />
          保存
        </Button>
      </div>
      <p class="text-xs text-muted-foreground flex items-center gap-1">
        <Key class="size-3" />
        写入项目根目录的 <code>.env</code>。
      </p>
    </template>
  </section>
</template>
```

- [ ] **Step 2: Run lint**

Run: `pnpm lint:eslint`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/views/settings/components/apimart-key.vue
git commit -m "refactor(settings): extract apimart-key section"
```

---

## Task 3: Extract `settings/components/deepseek-key.vue`

**Files:**
- Create: `src/views/settings/components/deepseek-key.vue`

- [ ] **Step 1: Write `deepseek-key.vue`**

Mirrors `apimart-key.vue` but uses `read_env_key` / `write_env_key` with `name: 'DEEPSEEK_API_KEY'`. Critically: `saveDeepseekKey` ends with `await store.scanProject()` — this must be preserved because saving the deepseek key changes the project's effective state (the gacha store re-derives `has_deepseek_key` from `.env`).

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { Key, Loader2, Save } from 'lucide-vue-next';
import { useGachaStore } from '@/stores/gacha';

const store = useGachaStore();

const deepseekKeyInput = ref('');
const deepseekKeyMasked = ref('');
const deepseekKeyStatus = ref<'unknown' | 'set' | 'unset'>('unknown');
const isSavingDeepseek = ref(false);

async function refreshDeepseekStatus() {
  if (!store.projectRoot) {
    deepseekKeyStatus.value = 'unknown';
    return;
  }
  const key = await invoke<string | null>('read_env_key', {
    root: store.projectRoot,
    name: 'DEEPSEEK_API_KEY',
  });
  deepseekKeyStatus.value = key ? 'set' : 'unset';
  deepseekKeyMasked.value = key ? `sk-****${key.slice(-4)}` : '';
}

async function saveDeepseekKey() {
  if (!store.projectRoot || !deepseekKeyInput.value.trim()) {
    return;
  }
  isSavingDeepseek.value = true;
  try {
    await invoke('write_env_key', {
      root: store.projectRoot,
      name: 'DEEPSEEK_API_KEY',
      value: deepseekKeyInput.value.trim(),
    });
    deepseekKeyInput.value = '';
    await refreshDeepseekStatus();
    await store.scanProject();
  } finally {
    isSavingDeepseek.value = false;
  }
}

const canSaveDeepseek = computed(() => Boolean(store.projectRoot) && deepseekKeyInput.value.trim().length > 0);

watch(
  () => store.projectRoot,
  async () => {
    await refreshDeepseekStatus();
  },
  { immediate: true },
);
</script>

<template>
  <section class="space-y-3">
    <h2 class="text-sm font-medium text-muted-foreground">
      DeepSeek key（写卡用）
    </h2>
    <p v-if="!store.projectRoot" class="text-xs text-muted-foreground">
      先设置项目目录。
    </p>
    <template v-else>
      <div class="text-xs">
        <span class="text-muted-foreground">当前：</span>
        <span v-if="deepseekKeyStatus === 'set'" class="font-mono">{{ deepseekKeyMasked }}</span>
        <span v-else-if="deepseekKeyStatus === 'unset'" class="text-red-600">未配置</span>
        <span v-else class="text-muted-foreground">读取中…</span>
      </div>
      <div class="flex gap-2">
        <Input
          v-model="deepseekKeyInput"
          type="password"
          placeholder="sk-..."
          class="flex-1 font-mono text-sm"
        />
        <Button :disabled="!canSaveDeepseek || isSavingDeepseek" @click="saveDeepseekKey">
          <Loader2 v-if="isSavingDeepseek" class="size-4 animate-spin" />
          <Save v-else class="size-4" />
          保存
        </Button>
      </div>
      <p class="text-xs text-muted-foreground flex items-center gap-1">
        <Key class="size-3" />
        写入同一份 <code>.env</code>（<code>DEEPSEEK_API_KEY</code>），画图 key 不动。
      </p>
    </template>
  </section>
</template>
```

- [ ] **Step 2: Run lint**

Run: `pnpm lint:eslint`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/views/settings/components/deepseek-key.vue
git commit -m "refactor(settings): extract deepseek-key section"
```

---

## Task 4: Extract `settings/components/deepseek-model.vue`

**Files:**
- Create: `src/views/settings/components/deepseek-model.vue`

- [ ] **Step 1: Write `deepseek-model.vue`**

Pure presentation: binds to `app.settings.deepseekModel` via a writable computed. No async handlers.

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { Cpu } from 'lucide-vue-next';
import { useAppStore } from '@/stores/app';

const app = useAppStore();

const deepseekModel = computed({
  get: () => app.settings.deepseekModel,
  set: v => app.updateSettings({ deepseekModel: v }),
});
</script>

<template>
  <section class="space-y-3">
    <h2 class="text-sm font-medium text-muted-foreground">
      DeepSeek 模型
    </h2>
    <Select v-model="deepseekModel">
      <SelectTrigger class="font-mono text-sm">
        <Cpu class="size-4 mr-2" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="deepseek-chat">
          deepseek-chat（快，几分钱一张）
        </SelectItem>
        <SelectItem value="deepseek-reasoner">
          deepseek-reasoner（慢，但更稳）
        </SelectItem>
      </SelectContent>
    </Select>
  </section>
</template>
```

- [ ] **Step 2: Run lint**

Run: `pnpm lint:eslint`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/views/settings/components/deepseek-model.vue
git commit -m "refactor(settings): extract deepseek-model section"
```

---

## Task 5: Slim `settings/index.vue` to orchestrator

**Files:**
- Modify: `src/views/settings/index.vue` (rewrite entirely — 221 → ~25 lines)

- [ ] **Step 1: Replace contents of `settings/index.vue`**

The orchestrator imports the 4 section components and renders them in order. `useGachaStore` is still imported (for the `onMounted` scan kick) but no other logic remains.

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useGachaStore } from '@/stores/gacha';
import ProjectDir from './components/project-dir.vue';
import ApimartKey from './components/apimart-key.vue';
import DeepseekKey from './components/deepseek-key.vue';
import DeepseekModel from './components/deepseek-model.vue';

const store = useGachaStore();

onMounted(() => {
  if (store.projectRoot) {
    store.scanProject();
  }
});
</script>

<template>
  <div class="h-full overflow-y-auto p-6 max-w-2xl mx-auto space-y-6">
    <h1 class="text-2xl font-semibold">
      设置
    </h1>
    <ProjectDir />
    <ApimartKey />
    <DeepseekKey />
    <DeepseekModel />
  </div>
</template>
```

Note: we keep `onMounted` here as a safety kick in case the persisted `projectRoot` from `gacha` store was loaded but `scanProject` hasn't run yet on this fresh visit. The two key components' `watch(immediate: true)` will handle initial status read regardless.

- [ ] **Step 2: Run lint + typecheck**

Run: `pnpm lint:eslint`
Expected: passes.

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.app.json`
Expected: passes (no type errors).

- [ ] **Step 3: Commit**

```bash
git add src/views/settings/index.vue
git commit -m "refactor(settings): reduce index.vue to orchestrator"
```

---

## Task 6: Extract `writer/components/form-pane.vue`

**Files:**
- Create: `src/views/writer/components/form-pane.vue`

- [ ] **Step 1: Create the components directory**

```bash
mkdir -p src/views/writer/components
```

- [ ] **Step 2: Write `form-pane.vue`**

Zero props. Reads `useGachaStore` + `useWriterStore` directly. The "next card name" helper is the only thing that needs `existingNames` (a derived list), which is computed here too.

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { Loader2, Sparkles } from 'lucide-vue-next';
import { useGachaStore } from '@/stores/gacha';
import { useWriterStore } from '@/stores/writer';
import { nextCardName } from '@/utils/prompt-directives';

const gacha = useGachaStore();
const writer = useWriterStore();

const categories = computed(() => gacha.project?.categories.map(c => c.name) ?? []);

const existingNames = computed(() => {
  const cat = gacha.project?.categories.find(c => c.name === writer.category);
  return cat?.prompts.map(p => p.name) ?? [];
});

function applyCategory(name: unknown) {
  if (typeof name !== 'string' || !name) {
    return;
  }
  writer.setCategory(name);
  if (gacha.project) {
    writer.name = nextCardName(existingNames.value);
  }
}

const canGenerate = computed(() =>
  Boolean(gacha.projectRoot)
  && Boolean(gacha.project?.has_deepseek_key)
  && !writer.isGenerating
  && Boolean(writer.category)
  && Boolean(writer.name.trim())
  && Boolean(writer.intent.trim()),
);

async function onGenerate() {
  await writer.generate();
}
</script>

<template>
  <div class="h-full flex flex-col p-6 gap-4 overflow-y-auto">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold">
        写卡
      </h1>
      <p class="text-sm text-muted-foreground">
        一句意图 → DeepSeek 出四段结构的 md → 人看一眼 → 保存 → 去抽卡。
      </p>
      <p v-if="!gacha.project.has_deepseek_key" class="text-xs text-red-600">
        还没配 DeepSeek key，去「设置」里加。
      </p>
    </header>

    <div class="space-y-2">
      <label class="text-xs text-muted-foreground">类目</label>
      <Select :model-value="writer.category" @update:model-value="applyCategory">
        <SelectTrigger class="font-mono text-sm">
          <SelectValue placeholder="选类目" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="cat of categories" :key="cat" :value="cat">
            {{ cat }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="space-y-2">
      <label class="text-xs text-muted-foreground">名字</label>
      <Input v-model="writer.name" class="font-mono text-sm" placeholder="10-摆烂" />
      <p class="text-xs text-muted-foreground">
        类目里有 {{ existingNames.length }} 张，建议下一个编号
      </p>
    </div>

    <div class="flex items-end gap-3">
      <div class="flex-1 space-y-2">
        <label class="text-xs text-muted-foreground">画幅</label>
        <Select v-model="writer.size">
          <SelectTrigger class="font-mono text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="opt of writer.SIZE_OPTIONS" :key="opt" :value="opt">
              {{ opt }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex-1 space-y-2">
        <label class="text-xs text-muted-foreground">分辨率</label>
        <Select v-model="writer.resolution">
          <SelectTrigger class="font-mono text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="opt of writer.RESOLUTION_OPTIONS" :key="opt" :value="opt">
              {{ opt }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div class="space-y-2 flex-1 min-h-0 flex flex-col">
      <label class="text-xs text-muted-foreground">意图</label>
      <Textarea
        v-model="writer.intent"
        class="flex-1 resize-none font-mono text-sm"
        placeholder="蹲在坑边上往里看，不是举牌警告，是好奇"
      />
    </div>

    <Button size="lg" :disabled="!canGenerate" @click="onGenerate">
      <Loader2 v-if="writer.isGenerating" class="size-4 animate-spin" />
      <Sparkles v-else class="size-4" />
      {{ writer.isGenerating ? '生成中…' : '生成' }}
    </Button>
  </div>
</template>
```

Note: the original button showed the active model name (`{{ app.settings.deepseekModel }}`) — we drop that micro-label here to keep the pane decoupled from `useAppStore`. If the user wants it back later, it can be added via a prop.

- [ ] **Step 3: Run lint**

Run: `pnpm lint:eslint`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/views/writer/components/form-pane.vue
git commit -m "refactor(writer): extract form-pane (left side)"
```

---

## Task 7: Extract `writer/components/draft-pane.vue`

**Files:**
- Create: `src/views/writer/components/draft-pane.vue`

- [ ] **Step 1: Write `draft-pane.vue`**

Props: `canSave` (boolean), `isReasoner` (boolean). Emits: `saveAndGo`, `toggleReasoning` (carries the new open state). Owns the `showReasoning` ref internally (it's pure UI fold state for the `<details>`).

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Brain, ChevronDown, ChevronRight, Save } from 'lucide-vue-next';
import { useWriterStore } from '@/stores/writer';

defineProps<{
  canSave: boolean;
  isReasoner: boolean;
}>();

const emit = defineEmits<{
  saveAndGo: [];
  toggleReasoning: [open: boolean];
}>();

const writer = useWriterStore();

const showReasoning = ref(false);

function onToggle(e: Event) {
  const open = (e.target as HTMLDetailsElement).open;
  showReasoning.value = open;
  emit('toggleReasoning', open);
}
</script>

<template>
  <div class="h-full flex flex-col">
    <header class="px-4 py-2 border-b bg-muted/20 flex items-center gap-3">
      <span class="text-xs text-muted-foreground flex-1">
        {{ writer.category || '—' }} / {{ writer.name || '—' }}.md
      </span>
      <Button
        size="sm"
        :disabled="!canSave"
        @click="emit('saveAndGo')"
      >
        <Save class="size-3" />
        保存并去抽卡
      </Button>
    </header>

    <div v-if="!isReasoner && writer.reasoning" class="border-b bg-muted/10 text-xs text-muted-foreground px-4 py-1 italic">
      （deepseek-chat 不输出思维链）
    </div>

    <details
      v-if="isReasoner && writer.reasoning"
      :open="showReasoning"
      class="border-b bg-muted/10"
      @toggle="onToggle"
    >
      <summary class="cursor-pointer select-none px-4 py-2 text-xs text-muted-foreground flex items-center gap-1">
        <component :is="showReasoning ? ChevronDown : ChevronRight" class="size-3" />
        <Brain class="size-3" />
        思维链 ({{ writer.reasoning.length }} 字)
      </summary>
      <pre class="whitespace-pre-wrap break-words px-4 pb-2 text-xs font-mono text-muted-foreground">{{ writer.reasoning }}</pre>
    </details>

    <div class="flex-1 overflow-hidden flex flex-col">
      <Textarea
        v-model="writer.draft"
        class="flex-1 resize-none font-mono text-sm leading-relaxed rounded-none border-0 focus-visible:ring-0"
        spellcheck="false"
        placeholder="生成的 md 会一个字一个字流到这里，可改"
      />
    </div>

    <footer v-if="writer.lastError" class="border-t px-4 py-2 text-xs text-red-600">
      {{ writer.lastError }}
    </footer>
  </div>
</template>
```

- [ ] **Step 2: Run lint**

Run: `pnpm lint:eslint`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/views/writer/components/draft-pane.vue
git commit -m "refactor(writer): extract draft-pane (right side)"
```

---

## Task 8: Slim `writer/index.vue` to orchestrator

**Files:**
- Modify: `src/views/writer/index.vue` (rewrite entirely — 240 → ~65 lines)

- [ ] **Step 1: Replace contents of `writer/index.vue`**

The orchestrator keeps: empty/scan guards, `onMounted` lifecycle (ensure context + auto-apply first category), the cross-component `canSave` / `isReasoner` computeds, and the `onSaveAndGo` handler that needs the router + toast.

```vue
<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { useGachaStore } from '@/stores/gacha';
import { useAppStore } from '@/stores/app';
import { useWriterStore } from '@/stores/writer';
import { nextCardName } from '@/utils/prompt-directives';
import FormPane from './components/form-pane.vue';
import DraftPane from './components/draft-pane.vue';

const router = useRouter();
const gacha = useGachaStore();
const app = useAppStore();
const writer = useWriterStore();

onMounted(() => {
  if (gacha.projectRoot) {
    writer.ensureContextLoaded(gacha.projectRoot);
    if (!writer.category && gacha.project?.categories.length) {
      const first = gacha.project.categories[0];
      if (first) {
        applyCategory(first.name);
      }
    }
  }
});

function applyCategory(name: unknown) {
  if (typeof name !== 'string' || !name) {
    return;
  }
  writer.setCategory(name);
  if (gacha.project) {
    const cat = gacha.project.categories.find(c => c.name === writer.category);
    const existing = cat?.prompts.map(p => p.name) ?? [];
    writer.name = nextCardName(existing);
  }
}

const isReasoner = computed(() => app.settings.deepseekModel === 'deepseek-reasoner');

const canSave = computed(() =>
  Boolean(gacha.projectRoot)
  && Boolean(writer.category)
  && Boolean(writer.name.trim())
  && Boolean(writer.draft.trim())
  && !writer.isGenerating,
);

async function onSaveAndGo() {
  const outcome = await writer.saveAndGo(path => router.push(path));
  if (!outcome.ok) {
    toast.error(outcome.error || '保存失败');
  } else {
    toast.success('已保存，去抽卡页看了');
  }
}
</script>

<template>
  <div class="h-full">
    <div v-if="!gacha.projectRoot" class="h-full flex items-center justify-center">
      <div class="text-center space-y-3 max-w-md">
        <h2 class="text-lg font-semibold">
          还没设置项目目录
        </h2>
        <p class="text-sm text-muted-foreground">
          去「设置」里选一个项目目录。
        </p>
      </div>
    </div>

    <div v-else-if="!gacha.project" class="h-full flex items-center justify-center">
      <p class="text-sm text-muted-foreground">
        正在扫描…
      </p>
    </div>

    <ResizablePanelGroup v-else direction="horizontal" class="h-full">
      <ResizablePanel :default-size="40" :min-size="30" :max-size="55">
        <FormPane />
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel :default-size="60" :min-size="35">
        <DraftPane
          :can-save="canSave"
          :is-reasoner="isReasoner"
          @save-and-go="onSaveAndGo"
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
```

Note on `applyCategory`: it now lives in `index.vue` (used by `onMounted`). The same logic also exists in `form-pane.vue` for the user-driven select change. Two copies is acceptable here because each has different inputs (form-pane receives `name` from the Select event; index.vue passes the persisted `first.name`). If duplication becomes annoying, the next refactor can hoist this into a small `useCategoryApply` composable — out of scope for this plan.

- [ ] **Step 2: Run lint + typecheck**

Run: `pnpm lint:eslint`
Expected: passes.

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.app.json`
Expected: passes (no type errors).

- [ ] **Step 3: Commit**

```bash
git add src/views/writer/index.vue
git commit -m "refactor(writer): reduce index.vue to orchestrator"
```

---

## Task 9: Full build + manual smoke

**Files:** none

- [ ] **Step 1: Run full build**

Run: `pnpm build`
Expected: `vue-tsc -b` succeeds, `vite build` emits to `dist/`. No type errors.

- [ ] **Step 2: Manual smoke (settings page)**

Run: `pnpm tauri:dev`

Verify:
- App launches, navigate to `/settings`
- Project dir section: clicking 浏览 opens native dialog, selecting a dir updates the readonly Input
- APIMart key section: appears after project dir is set, current status shows "未配置" or masked key
- DeepSeek key section: appears after project dir is set, current status displays correctly
- Saving either key: input clears, status refreshes, save button returns to normal
- DeepSeek 模型 select: switching between chat and reasoner persists across page reload
- Selecting a project dir triggers a refresh of both key status sections (watcher migration works)

- [ ] **Step 3: Manual smoke (writer page)**

Verify:
- App launches, navigate to `/writer`
- Empty state shows when no projectRoot
- Scanning state shows when projectRoot set but project not yet loaded
- Form pane: category select populates from project, name auto-fills with `nextCardName`, size/resolution selects work, intent textarea works, generate button disabled until canGenerate is true
- Draft pane: header shows `category / name.md`, generates stream into the textarea, toggle reasoning details when model is reasoner, save-and-go navigates to `/gacha` and shows toast
- Active model label no longer shown on generate button (intentional drop — see Task 6 note)

- [ ] **Step 4: Commit any incidental fixes (if needed)**

If smoke surfaced anything, fix and commit per fix with `chore(settings|writer): ...` or `fix(...): ...`. Otherwise: nothing to commit, done.