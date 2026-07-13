<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Code2,
  Link as LinkIcon,
  Undo,
  Redo,
  Loader2,
  Save,
} from 'lucide-vue-next';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';
import { useContextStore } from '@/stores/context';
import { useGachaStore } from '@/stores/gacha';
import type { ContextKind } from '@/types/writer';

interface MarkdownStorage { getMarkdown: () => string }
const props = defineProps<{
  kind: ContextKind;
  helperText: string;
  label: string;
}>();

function readMarkdown(ed: { storage: unknown }): string {
  const s = (ed.storage as { markdown?: MarkdownStorage } | null | undefined)?.markdown;
  return s ? s.getMarkdown() : '';
}

const store = useContextStore();
const project = useGachaStore();

const draft = ref('');
const lastSaved = ref('');
let syncing = false;

const content = computed(() => (props.kind === 'ip' ? store.ip : store.agents));
const path = computed(() => (props.kind === 'ip' ? store.ipPath : store.agentsPath));
const dirty = computed(() => draft.value !== lastSaved.value);
const canSave = computed(() => Boolean(project.projectRoot) && dirty.value && !store.isSaving);

const editor = useEditor({
  extensions: [
    StarterKit,
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } }),
    Markdown.configure({
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ],
  onCreate: () => {
    syncFromExternal(content.value);
  },
  onUpdate: ({ editor: ed }) => {
    if (syncing) {
      return;
    }
    draft.value = readMarkdown(ed);
  },
});

function syncFromExternal(value: string) {
  const ed = editor.value;
  if (!ed) {
    draft.value = value;
    lastSaved.value = value;
    return;
  }
  const current = readMarkdown(ed);
  if (current === value) {
    draft.value = value;
    lastSaved.value = value;
    return;
  }

  syncing = true;
  try {
    ed.commands.setContent(value, { emitUpdate: false });
  } finally {
    syncing = false;
  }
  lastSaved.value = value;
  draft.value = value;
}

watch(content, value => syncFromExternal(value));

async function onSave() {
  if (!project.projectRoot) {
    return;
  }
  const ok = await store.save(project.projectRoot, props.kind, draft.value);
  if (ok) {
    lastSaved.value = draft.value;
  }
}

function setLink() {
  const ed = editor.value;
  if (!ed) {
    return;
  }
  const prev = (ed.getAttributes('link').href as string | undefined) ?? '';
  // eslint-disable-next-line no-alert
  const url = window.prompt('链接地址', prev || 'https://');
  if (url === null) {
    return;
  }
  if (url === '') {
    ed.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  ed.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<template>
  <div class="h-full flex flex-col p-6 max-w-4xl mx-auto gap-4">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold">
        {{ label }}
      </h1>
      <p class="text-sm text-muted-foreground">
        {{ helperText }}
      </p>
      <p class="text-xs text-muted-foreground font-mono break-all">
        正在改 <code>{{ path || '—' }}</code>
      </p>
    </header>

    <div v-if="!project.projectRoot" class="rounded border border-dashed p-6 text-sm text-muted-foreground">
      先去「设置」里选一个项目目录。
    </div>

    <template v-else>
      <div v-if="editor" class="flex flex-col flex-1 min-h-[60vh] rounded border bg-muted/30 overflow-hidden">
        <div class="flex flex-wrap items-center gap-0.5 border-b bg-background/60 p-1.5">
          <button
            type="button"
            class="tb-btn"
            :class="{ active: editor.isActive('bold') }"
            :disabled="!editor.can().chain().focus().toggleBold().run()"
            title="加粗 (Ctrl+B)"
            @click="editor.chain().focus().toggleBold().run()"
          >
            <Bold class="size-4" />
          </button>
          <button
            type="button"
            class="tb-btn"
            :class="{ active: editor.isActive('italic') }"
            :disabled="!editor.can().chain().focus().toggleItalic().run()"
            title="斜体 (Ctrl+I)"
            @click="editor.chain().focus().toggleItalic().run()"
          >
            <Italic class="size-4" />
          </button>
          <button
            type="button"
            class="tb-btn"
            :class="{ active: editor.isActive('strike') }"
            :disabled="!editor.can().chain().focus().toggleStrike().run()"
            title="删除线"
            @click="editor.chain().focus().toggleStrike().run()"
          >
            <Strikethrough class="size-4" />
          </button>

          <span class="tb-sep" />

          <button
            type="button"
            class="tb-btn"
            :class="{ active: editor.isActive('heading', { level: 1 }) }"
            title="一级标题"
            @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
          >
            <Heading1 class="size-4" />
          </button>
          <button
            type="button"
            class="tb-btn"
            :class="{ active: editor.isActive('heading', { level: 2 }) }"
            title="二级标题"
            @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
          >
            <Heading2 class="size-4" />
          </button>
          <button
            type="button"
            class="tb-btn"
            :class="{ active: editor.isActive('heading', { level: 3 }) }"
            title="三级标题"
            @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
          >
            <Heading3 class="size-4" />
          </button>

          <span class="tb-sep" />

          <button
            type="button"
            class="tb-btn"
            :class="{ active: editor.isActive('bulletList') }"
            title="无序列表"
            @click="editor.chain().focus().toggleBulletList().run()"
          >
            <List class="size-4" />
          </button>
          <button
            type="button"
            class="tb-btn"
            :class="{ active: editor.isActive('orderedList') }"
            title="有序列表"
            @click="editor.chain().focus().toggleOrderedList().run()"
          >
            <ListOrdered class="size-4" />
          </button>
          <button
            type="button"
            class="tb-btn"
            :class="{ active: editor.isActive('blockquote') }"
            title="引用"
            @click="editor.chain().focus().toggleBlockquote().run()"
          >
            <Quote class="size-4" />
          </button>

          <span class="tb-sep" />

          <button
            type="button"
            class="tb-btn"
            :class="{ active: editor.isActive('code') }"
            title="行内代码"
            @click="editor.chain().focus().toggleCode().run()"
          >
            <Code class="size-4" />
          </button>
          <button
            type="button"
            class="tb-btn"
            :class="{ active: editor.isActive('codeBlock') }"
            title="代码块"
            @click="editor.chain().focus().toggleCodeBlock().run()"
          >
            <Code2 class="size-4" />
          </button>
          <button
            type="button"
            class="tb-btn"
            :class="{ active: editor.isActive('link') }"
            title="链接"
            @click="setLink"
          >
            <LinkIcon class="size-4" />
          </button>

          <span class="tb-sep" />

          <button
            type="button"
            class="tb-btn"
            :disabled="!editor.can().chain().focus().undo().run()"
            title="撤销 (Ctrl+Z)"
            @click="editor.chain().focus().undo().run()"
          >
            <Undo class="size-4" />
          </button>
          <button
            type="button"
            class="tb-btn"
            :disabled="!editor.can().chain().focus().redo().run()"
            title="重做 (Ctrl+Shift+Z)"
            @click="editor.chain().focus().redo().run()"
          >
            <Redo class="size-4" />
          </button>
        </div>

        <EditorContent :editor="editor" class="ctx-scroll flex-1 overflow-auto" />
      </div>

      <footer class="flex items-center justify-between gap-3">
        <span v-if="store.lastError" class="text-xs text-red-600 flex-1 break-all">
          {{ store.lastError }}
        </span>
        <span v-else-if="dirty" class="text-xs text-muted-foreground">
          未保存
        </span>
        <span v-else class="text-xs text-muted-foreground">
          已保存
        </span>
        <Button :disabled="!canSave" @click="onSave">
          <Loader2 v-if="store.isSaving" class="size-4 animate-spin" />
          <Save v-else class="size-4" />
          保存
        </Button>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  padding: 0.375rem;
  color: hsl(var(--muted-foreground));
  transition: background-color 0.15s, color 0.15s;
}
.tb-btn:hover:not(:disabled) {
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}
.tb-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tb-btn.active {
  background: hsl(var(--primary) / 0.15);
  color: hsl(var(--primary));
}
.tb-sep {
  display: inline-block;
  width: 1px;
  height: 1.1rem;
  background: hsl(var(--border));
  margin: 0 0.25rem;
}

.ctx-scroll :deep(.ProseMirror) {
  min-height: 100%;
  padding: 1rem;
  outline: none;
  line-height: 1.65;
  color: hsl(var(--foreground));
  font-size: 0.95rem;
}
.ctx-scroll :deep(.ProseMirror p) { margin: 0.5rem 0; }
.ctx-scroll :deep(.ProseMirror h1) {
  font-size: 1.6rem;
  font-weight: 600;
  margin: 1.25rem 0 0.75rem;
  border-bottom: 1px solid hsl(var(--border));
  padding-bottom: 0.35rem;
}
.ctx-scroll :deep(.ProseMirror h2) { font-size: 1.35rem; font-weight: 600; margin: 1.1rem 0 0.6rem; }
.ctx-scroll :deep(.ProseMirror h3) { font-size: 1.15rem; font-weight: 600; margin: 1rem 0 0.5rem; }
.ctx-scroll :deep(.ProseMirror h4),
.ctx-scroll :deep(.ProseMirror h5),
.ctx-scroll :deep(.ProseMirror h6) { font-weight: 600; margin: 0.9rem 0 0.4rem; }
.ctx-scroll :deep(.ProseMirror ul),
.ctx-scroll :deep(.ProseMirror ol) { margin: 0.5rem 0; padding-left: 1.5rem; }
.ctx-scroll :deep(.ProseMirror li) { margin: 0.2rem 0; }
.ctx-scroll :deep(.ProseMirror blockquote) {
  border-left: 3px solid hsl(var(--primary));
  background: hsl(var(--muted) / 0.5);
  padding: 0.5rem 0.85rem;
  border-radius: 0.25rem;
  margin: 0.75rem 0;
}
.ctx-scroll :deep(.ProseMirror code) {
  background: hsl(var(--muted));
  color: hsl(var(--primary));
  padding: 0.05rem 0.35rem;
  border-radius: 0.25rem;
  font-family: 'JetBrains Mono', 'Menlo', 'Courier New', monospace;
  font-size: 0.88em;
}
.ctx-scroll :deep(.ProseMirror pre) {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  padding: 0.85rem;
  margin: 0.75rem 0;
  overflow-x: auto;
}
.ctx-scroll :deep(.ProseMirror pre code) {
  background: transparent;
  color: inherit;
  padding: 0;
}
.ctx-scroll :deep(.ProseMirror hr) {
  border: none;
  border-top: 1px solid hsl(var(--border));
  margin: 1.25rem 0;
}
.ctx-scroll :deep(.ProseMirror a) {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 3px;
}
.ctx-scroll :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: '在这里写正文…';
  float: left;
  color: hsl(var(--muted-foreground));
  pointer-events: none;
  height: 0;
}
</style>
