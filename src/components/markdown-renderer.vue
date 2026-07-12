<script setup lang="ts">
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import anchor from 'markdown-it-anchor';
import MdMermaid from 'mermaid-it-markdown';

interface Props {
  content: string;
  isStreaming?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
});

const containerRef = ref<HTMLElement>();

function highlightBlock(str: string, lang?: string) {
  return `<pre class="code-block-wrapper"><div class="code-block-header"><span class="code-block-header__lang">${lang}</span><span class="code-block-header__copy">复制代码</span></div><code class="hljs code-block-body ${lang}">${str}</code></pre>`;
}

// 配置 markdown-it
const md: MarkdownIt = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
  highlight(code, language) {
    const validLang = !!(language && hljs.getLanguage(language));
    if (validLang) {
      const lang = language ?? '';
      return highlightBlock(hljs.highlight(code, { language: lang }).value, lang);
    }
    return highlightBlock(hljs.highlightAuto(code).value, '');
  },
});

md.use(anchor)
  .use(MdMermaid);

// 自定义渲染规则
md.renderer.rules.table_open = (): string => '<div class="table-wrapper"><table class="markdown-table">';
md.renderer.rules.table_close = (): string => '</table></div>';
md.renderer.rules.code_inline = (tokens: any[], idx: number): string => {
  const token = tokens[idx] as { content: string };
  return `<code class="inline-code">${md.utils.escapeHtml(token.content)}</code>`;
};

const renderedContent = computed(() => {
  try {
    return md.render(props.content);
  } catch (error) {
    console.error('Markdown渲染错误:', error);
    return `<p>渲染错误: ${error}</p>`;
  }
});
</script>

<template>
  <div class="markdown-renderer">
    <div
      ref="containerRef"
      class="markdown-content"
      v-html="renderedContent"
    />
    <span v-if="isStreaming" class="cursor" />
  </div>
</template>

<style scoped>
.markdown-content {
  line-height: 1.6;
  color: hsl(var(--foreground));
}

.markdown-content :deep(h1) {
  font-size: 2rem;
  font-weight: bold;
  margin: 2rem 0 1rem 0;
  border-bottom: 1px solid hsl(var(--border));
  padding-bottom: 0.5rem;
}

.markdown-content :deep(h2) {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 1.5rem 0 0.75rem 0;
}

.markdown-content :deep(h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1.25rem 0 0.5rem 0;
}

.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  font-weight: 600;
  margin: 1rem 0 0.5rem 0;
}

.markdown-content :deep(p) {
  margin: 0.75rem 0;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 0.75rem 0;
  padding-left: 1.5rem;
}

.markdown-content :deep(li) {
  margin: 0.25rem 0;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid hsl(var(--primary));
  padding-left: 1rem;
  margin: 1rem 0;
  background: hsl(var(--muted) / 0.3);
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
}

.markdown-content :deep(.table-wrapper) {
  overflow-x: auto;
  margin: 1rem 0;
}

.markdown-content :deep(.markdown-table) {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
}

.markdown-content :deep(.markdown-table th),
.markdown-content :deep(.markdown-table td) {
  border: 1px solid hsl(var(--border));
  padding: 0.75rem;
  text-align: left;
}

.markdown-content :deep(.markdown-table th) {
  background: hsl(var(--muted));
  font-weight: 600;
}

.markdown-content :deep(.inline-code) {
  background: hsl(var(--muted));
  color: hsl(var(--primary));
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875em;
}

.markdown-content :deep(pre.hljs) {
  background: hsl(var(--card)) !important;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1rem 0;
  overflow-x: auto;
  position: relative;
}

.markdown-content :deep(.copy-btn) {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.markdown-content :deep(.copy-btn:hover) {
  opacity: 1;
}

.markdown-content :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 4px;
}

.markdown-content :deep(a:hover) {
  color: hsl(var(--primary) / 0.8);
}

.markdown-content :deep(strong) {
  font-weight: 600;
}

.markdown-content :deep(em) {
  font-style: italic;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid hsl(var(--border));
  margin: 2rem 0;
}

.cursor {
  display: inline-block;
  width: 2px;
  height: 1.25rem;
  background: currentColor;
  margin-left: 0.25rem;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>
