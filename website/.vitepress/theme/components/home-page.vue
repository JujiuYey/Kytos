<script setup lang="ts">
import {
  ArrowRight,
  BookMarked,
  Code2,
  HardDrive,
  Images,
  Sparkles,
  UsersRound,
} from '@lucide/vue';
import chibiImage from '../../../../src/assets/character-styles/chibi-kawaii-male.png';
import flatImage from '../../../../src/assets/character-styles/flat-editorial-male.png';
import inkImage from '../../../../src/assets/character-styles/chinese-ink-male.png';
import noirImage from '../../../../src/assets/character-styles/cinematic-noir-male.png';

const capabilities = [
  {
    description: '从角色设定、风格探索到正式视觉、动作和表情，保持同一角色的创作上下文。',
    href: '/Kytos/guide/character',
    icon: UsersRound,
    title: '建立角色',
  },
  {
    description: '组合角色视觉、表情和已有插画作为参考，通过对话整理主题并管理多个版本。',
    href: '/Kytos/guide/illustration',
    icon: Images,
    title: '创作插画',
  },
  {
    description: '从故事草稿推进到分镜，逐镜头维护内容、画面版本和连续性。',
    href: '/Kytos/guide/story',
    icon: BookMarked,
    title: '编排故事',
  },
];
</script>

<template>
  <main class="kytos-home">
    <section class="kytos-hero" aria-labelledby="kytos-home-title">
      <div class="kytos-hero-gallery" aria-label="Kytos 内置角色视觉风格示例">
        <img :src="flatImage" alt="平面撞色角色风格" />
        <img :src="chibiImage" alt="软萌 Q 版角色风格" />
        <img :src="inkImage" alt="新中式水墨角色风格" />
        <img :src="noirImage" alt="写实电影角色风格" />
      </div>
      <div class="kytos-hero-shade" aria-hidden="true" />
      <div class="kytos-hero-content">
        <p class="kytos-eyebrow"><Sparkles aria-hidden="true" /> 本地优先的 AI 创作工作台</p>
        <h1 id="kytos-home-title">Kytos</h1>
        <p class="kytos-hero-copy">
          把角色、视觉资产、插画与故事放进同一个桌面工作区，让创作过程与作品文件都留在你的设备上。
        </p>
        <div class="kytos-hero-actions">
          <a class="kytos-action kytos-action-primary" href="/Kytos/getting-started/">
            开始使用
            <ArrowRight aria-hidden="true" />
          </a>
          <a
            class="kytos-action kytos-action-secondary"
            href="https://github.com/JujiuYey/Kytos"
            rel="noreferrer"
            target="_blank"
          >
            <Code2 aria-hidden="true" />
            查看源码
          </a>
        </div>
      </div>
    </section>

    <section class="kytos-intro" aria-labelledby="kytos-intro-title">
      <div>
        <p class="kytos-section-label">一个工作区，贯穿整个创作过程</p>
        <h2 id="kytos-intro-title">先建立角色，再让视觉和故事持续生长。</h2>
      </div>
      <p>
        Kytos
        不把每次生成当成孤立结果。正式角色视觉、表情、插画版本和故事分镜会成为后续创作可以继续引用的素材。
      </p>
    </section>

    <section class="kytos-capabilities" aria-label="Kytos 主要能力">
      <a
        v-for="capability in capabilities"
        :key="capability.title"
        class="kytos-capability"
        :href="capability.href"
      >
        <component :is="capability.icon" class="kytos-capability-icon" aria-hidden="true" />
        <div>
          <h2>{{ capability.title }}</h2>
          <p>{{ capability.description }}</p>
        </div>
        <ArrowRight class="kytos-capability-arrow" aria-hidden="true" />
      </a>
    </section>

    <section class="kytos-local" aria-labelledby="kytos-local-title">
      <div class="kytos-local-heading">
        <HardDrive aria-hidden="true" />
        <div>
          <p class="kytos-section-label">Local first</p>
          <h2 id="kytos-local-title">作品数据由你保管</h2>
        </div>
      </div>
      <div class="kytos-local-details">
        <p>角色资料、生成记录和图片资产写入你选择的本地工作区。</p>
        <p>API Key 由 Electron 安全存储加密，不会写入作品目录或返回渲染界面。</p>
      </div>
      <a href="/Kytos/guide/workspace">
        了解数据边界
        <ArrowRight aria-hidden="true" />
      </a>
    </section>
  </main>
</template>
