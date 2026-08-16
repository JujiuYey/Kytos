<script setup lang="ts">
import {
  ArrowRight,
  BookMarked,
  Code2,
  Download,
  HardDrive,
  Images,
  Sparkles,
  UsersRound,
} from '@lucide/vue';

const capabilities = [
  {
    description: '从一组角色锚点开始，整理正式资产、动作图与表情，让后续创作有稳定的角色参考。',
    href: '/Kytos/guide/character',
    icon: UsersRound,
    title: '沉淀形象 IP',
  },
  {
    description: '把同一角色在不同场景中持续生图，让角色可识别、可复用。',
    href: '/Kytos/guide/illustration',
    icon: Images,
    title: '一致性生图',
  },
  {
    description: '把多个角色组织成分镜，逐步累积到一份完整作品。',
    href: '/Kytos/guide/story',
    icon: BookMarked,
    title: '故事与作品流',
  },
];

const screenshots = {
  characterCreate: '/Kytos/docs/screenshots/02-character-create.png',
  characterAssets: '/Kytos/docs/screenshots/04-character-assets.png',
  illustration: '/Kytos/docs/screenshots/05-illustration-create.png',
  story: '/Kytos/docs/screenshots/07-story-create.png',
};
</script>

<template>
  <main class="kytos-home">
    <section class="kytos-hero" aria-labelledby="kytos-home-title">
      <div class="kytos-hero-gallery" aria-label="Kytos 角色、插画与故事工作区">
        <img :src="screenshots.characterCreate" alt="创建角色页面" />
        <img :src="screenshots.characterAssets" alt="角色锚点与表情页面" />
        <img :src="screenshots.illustration" alt="插画创作页面" />
        <img :src="screenshots.story" alt="故事创作页面" />
      </div>
      <div class="kytos-hero-shade" aria-hidden="true" />
      <div class="kytos-hero-content">
        <p class="kytos-eyebrow">
          <Sparkles aria-hidden="true" /> 形象 IP 创作工作台 · MIT 开源 · 本地优先
        </p>
        <h1 id="kytos-home-title">Kytos</h1>
        <p class="kytos-hero-copy">
          为个人创作者维护一张可复用的角色资产表：以同一组形象锚点持续做插画、故事分镜和作品积累，所有素材与生成记录留在你的设备上。
        </p>
        <div class="kytos-hero-actions">
          <a class="kytos-action kytos-action-primary" href="/Kytos/getting-started/">
            开始使用
            <ArrowRight aria-hidden="true" />
          </a>
          <a
            class="kytos-action kytos-action-secondary"
            href="https://github.com/JujiuYey/Kytos/releases/latest"
            rel="noreferrer"
            target="_blank"
          >
            <Download aria-hidden="true" />
            下载 v0.1.0
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

    <section class="kytos-why" aria-labelledby="kytos-why-title">
      <header class="kytos-why-heading">
        <p class="kytos-section-label">为什么用 Kytos</p>
        <h2 id="kytos-why-title">不让"角色一致性"卡在脑内。</h2>
      </header>
      <div class="kytos-why-grid">
        <article class="kytos-why-col kytos-why-pain">
          <h3>散装方案的痛</h3>
          <ul>
            <li>角色设定写在文档或脑内，生图时手动复制粘贴</li>
            <li>参考图、生成记录、作品分布在多个工具之间</li>
            <li>同一个角色十次出图，十个长相，全靠记忆对齐</li>
            <li>版权敏感的 IP 资产不便放心放在云上</li>
          </ul>
        </article>
        <article class="kytos-why-col kytos-why-fix">
          <h3>Kytos 的做法</h3>
          <ul>
            <li>形象锚点、表情、动作挂在角色本身，AI 出图自动引用</li>
            <li>参考素材、生成版本、作品统一在本地工作区</li>
            <li>同一组锚点持续生图，角色长相、风格、调性自然一致</li>
            <li>作品与 API Key 留在你的设备上，MIT 协议开源</li>
          </ul>
        </article>
      </div>
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
