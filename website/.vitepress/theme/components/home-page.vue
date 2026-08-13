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
import characterCreateImage from '../../../../docs/screenshots/02-character-create.png';
import characterAssetsImage from '../../../../docs/screenshots/04-character-assets.png';
import illustrationImage from '../../../../docs/screenshots/05-illustration-create.png';
import storyImage from '../../../../docs/screenshots/07-story-create.png';

const capabilities = [
  {
    description: '从已有角色锚点开始，整理正式资产、动作图和表情，让后续创作有稳定的角色参考。',
    href: '/Kytos/guide/character',
    icon: UsersRound,
    title: '整理角色资产',
  },
  {
    description: '组合角色锚点、表情和已有插画作为参考，通过对话整理主题并管理多个版本。',
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
      <div class="kytos-hero-gallery" aria-label="Kytos 角色、插画与故事工作区">
        <img :src="characterCreateImage" alt="创建角色页面" />
        <img :src="characterAssetsImage" alt="角色锚点与表情页面" />
        <img :src="illustrationImage" alt="插画创作页面" />
        <img :src="storyImage" alt="故事创作页面" />
      </div>
      <div class="kytos-hero-shade" aria-hidden="true" />
      <div class="kytos-hero-content">
        <p class="kytos-eyebrow"><Sparkles aria-hidden="true" /> 本地优先的视觉创作工作台</p>
        <h1 id="kytos-home-title">Kytos</h1>
        <p class="kytos-hero-copy">
          把角色资产、插画与故事分镜放进同一个桌面工作区，让参考素材、生成版本与作品文件留在你的设备上。
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
        <h2 id="kytos-intro-title">先整理角色资产，再让插画和故事持续生长。</h2>
      </div>
      <p>
        Kytos
        不把每次生成当成孤立结果。正式角色锚点、表情、插画版本和故事分镜会成为后续创作可以继续引用的素材。
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
