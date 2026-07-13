# SPEC：拆分 `src/views/*/index.vue`

> 2026-07-13 · 配套现有 `docs/spec-写卡.md` / `docs/spec-抽卡.md`。

## 一句话

把 `views/settings/index.vue`（221 行）和 `views/writer/index.vue`（240 行）按视觉 section 拆成 co-located 子组件，让两个 `index.vue` 退化成纯编排壳，与已存在的 `views/gacha/` 模式对齐。

## 现状

`src/views/` 下五个页面：

| 文件 | 行数 | 是否需要拆 |
|---|---|---|
| `character/index.vue` | 23 | 否——已是壳，套 `<ContextEditor kind="ip" />` |
| `strategy/index.vue` | 23 | 否——同上，套 `<ContextEditor kind="agents" />` |
| `gacha/index.vue` | 54 | 否——已是编排壳，三个子组件已就位 |
| `settings/index.vue` | 221 | **是**——4 个独立 section，自带 state |
| `writer/index.vue` | 240 | **是**——左表单 + 右草稿 + 空/扫描态，三块逻辑混着 |

既有约定（参考 `views/gacha/components/`）：

- kebab-case 文件名
- `views/<page>/components/<kebab-case>.vue` co-located
- 子组件内自管 state，`index.vue` 只编排

## 范围

### 做

- 拆 `settings/index.vue` → 4 个 section 组件
- 拆 `writer/index.vue` → 2 个 pane 组件 + 保留页面级空/扫描态在 `index.vue`
- `index.vue` 只剩容器、入场副作用、跨组件的 computed/handler
- 每个 section/pane 组件**内部持有** ref / watch / 保存 loading，零 props、零 emits（除非两个组件需要协调——目前没有）

### 不做（YAGNI）

- 不抽 `useProjectRootGuard` composable——「还没设置项目目录 / 正在扫描」在 gacha、writer 各有一份，本次只拆 writer 不动 gacha，不跨页面统一
- 不把 apimart / deepseek 两个 key section 抽象成通用 `ApiKeySection`——只有两份代码、调用 Tauri command 略有差异，抽象边界不清晰
- 不改 store（不动 `useGachaStore` / `useAppStore` / `useWriterStore`）
- 不改路由、不动导航
- 不补测试——项目里没有测试基础设施

## 目标结构

```
src/views/settings/
  index.vue                    # 编排：4 个 section，max-w-2xl mx-auto 容器
  components/
    project-dir.vue            # 选项目目录按钮 + 输入框
    apimart-key.vue            # APIMart key 输入 + 状态 + 保存
    deepseek-key.vue           # DeepSeek key 输入 + 状态 + 保存
    deepseek-model.vue         # 模型选择 Select

src/views/writer/
  index.vue                    # 编排：空态 / 扫描态 / ResizablePanelGroup + 两个 pane；onMounted 副作用
  components/
    form-pane.vue              # 左：类目 / 名字 / 画幅 / 分辨率 / 意图 / 生成按钮
    draft-pane.vue             # 右：header / 思维链 / 草稿 textarea / footer 错误
```

## 设计要点

### settings

`index.vue` 残留约 20 行：

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useGachaStore } from '@/stores/gacha';
import ProjectDir from './components/project-dir.vue';
import ApimartKey from './components/apimart-key.vue';
import DeepseekKey from './components/deepseek-key.vue';
import DeepseekModel from './components/deepseek-model.vue';

const store = useGachaStore();
onMounted(() => { if (store.projectRoot) store.scanProject(); });
</script>

<template>
  <div class="h-full overflow-y-auto p-6 max-w-2xl mx-auto space-y-6">
    <h1 class="text-2xl font-semibold">设置</h1>
    <ProjectDir />
    <ApimartKey />
    <DeepseekKey />
    <DeepseekModel />
  </div>
</template>
```

**关键迁移点：**

1. `watch(() => store.projectRoot, refreshApimartStatus + refreshDeepseekStatus, { immediate: true })` 现在被拆到两个 key 组件**各自** watch `store.projectRoot`。逻辑重复两遍，但解耦，符合「section 内部持有」原则。
2. `saveDeepseekKey` 末尾有 `await store.scanProject()`——保留在 `deepseek-key.vue` 里。
3. `chooseProjectDir` 末尾的 `await refreshApimartStatus() + await refreshDeepseekStatus()`——`project-dir.vue` 选中目录后**不直接调**两个 key 组件的 refresh；改用 `store.projectRoot` 的 watcher 触发（迁移点 1 的副作用自然生效）。`project-dir.vue` 只负责 `store.projectRoot = selected` + `store.scanProject()`。

### writer

`index.vue` 残留约 50 行：

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

onMounted(() => { /* ensureContextLoaded + applyCategory */ });

const isReasoner = computed(() => app.settings.deepseekModel === 'deepseek-reasoner');
const canSave = computed(() => /* 同原逻辑 */ );

async function onSaveAndGo() { /* 同原逻辑 */ }
</script>

<template>
  <div class="h-full">
    <div v-if="!gacha.projectRoot" class="h-full flex items-center justify-center">...</div>
    <div v-else-if="!gacha.project" class="h-full flex items-center justify-center">...</div>
    <ResizablePanelGroup v-else direction="horizontal" class="h-full">
      <ResizablePanel :default-size="40" :min-size="30" :max-size="55">
        <FormPane />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel :default-size="60" :min-size="35">
        <DraftPane :can-save="canSave" :is-reasoner="isReasoner" @save-and-go="onSaveAndGo" />
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
```

**关键决策：**

1. **`FormPane` 零 props**——它用到的 `categories` / `existingNames` 都是从 `useGachaStore` + `useWriterStore` 派生的，组件内部直接 `useGachaStore()` 取值。`canGenerate` 留在 index.vue 计算（依赖 store），但实际不需要传——`FormPane` 内部直接读 `writer.isGenerating` 等自己拼。**最终 `FormPane` 也零 props**。
2. **`DraftPane` 必须有 props + emits**——因为它需要触发 `router.push`（路由跳转只在 index.vue 里合法，组件不直接拿 router）和 toast 提示。Props: `:can-save :is-reasoner`。Emits: `@save-and-go @toggle-reasoning`。
3. **`showReasoning` ref 留在 `DraftPane` 内部**——它本来就是纯 UI 局部状态（思维链折叠），从 index.vue 移到 DraftPane 自管。
4. **错误显示 `writer.lastError`**——`<footer v-if="writer.lastError">` 跟着 DraftPane 走（错误显示的是右侧草稿区的上下文）。
5. **空态 / 扫描态留在 index.vue**——它们是页面级 guard，不属于任何 pane。

## 数据流

```
useGachaStore  ─┐
useAppStore    ─┼──> FormPane / DraftPane / settings/* 直接 useXxxStore()
useWriterStore ─┘

index.vue 只做：
  - 容器 + 路由级布局（ResizablePanelGroup）
  - onMounted 副作用
  - 跨组件协调的 handler（saveAndGo 里的 router.push + toast）
```

无新增 store、无新增 props 跨页、无 emit 链。

## 边界

| 行为 | 现在 | 拆后 |
|---|---|---|
| 选项目目录后刷新 key 状态 | index.vue watch projectRoot → 调两个 refresh | project-dir 写 store → 两个 key 组件各自 watch projectRoot → 各自 refresh |
| 保存 deepseek key 后扫项目 | deepseek-key 内 | 不变，仍在 deepseek-key 内 |
| 思维链展开状态 | index.vue 的 showReasoning ref | DraftPane 内部 ref |
| 保存并跳抽卡 | index.vue handler → router.push + toast | index.vue handler 不变，DraftPane emit save-and-go |
| 空态 / 扫描态 | index.vue | 不变，仍在 index.vue |

## 验收

1. `views/settings/index.vue` ≤ 30 行，只做编排
2. `views/writer/index.vue` ≤ 70 行，只做编排（含空态 / ResizablePanelGroup / handler）
3. 6 个新文件按目标结构落地，文件名 kebab-case
4. `pnpm dev` 启动后：
   - 设置页：选目录、两个 key 保存、模型切换——行为与现在完全一致
   - 写卡页：类目切换、生成、保存并跳抽卡、思维链折叠——行为完全一致
5. `pnpm lint:eslint` 通过
6. `pnpm build` 通过（vue-tsc 检查类型）

## 风险

- **projectRoot watcher 重复**：`apimart-key` 和 `deepseek-key` 各自 watch `store.projectRoot`，第一次挂载 + 选中目录会各触发一次 `read_*`。可接受——两个 key 本来就要各自读。
- **`isReasoner` / `canSave` 计算位置**：放在 index.vue 是为了不污染 pane，但意味着这两个 computed 在 pane 重新挂载时不会丢（pinia store 里数据还在）。OK。
- **component 重新挂载**：之前 settings 是个大文件，所有 ref 在页面生命周期里持续存在；拆完后切到别的页面再切回，section 组件会重新挂载，ref 重置。**目前不影响行为**——用户每次进 settings 都要重新输 key 是合理的。

## 不在本次范围

- 抽 `useProjectRootGuard` / 统一空态组件
- 抽象通用 `ApiKeySection`
- 改 store、加 getter
- 加单元测试
- 改路由 / 导航 / 主题