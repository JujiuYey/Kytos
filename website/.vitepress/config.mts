import { defineConfig } from 'vitepress';

export default defineConfig({
  base: '/Kytos/',
  cleanUrls: true,
  description: 'Kytos 是一个本地优先的 AI 角色与视觉内容创作工作台。',
  head: [
    ['meta', { content: '#111827', name: 'theme-color' }],
    ['meta', { content: 'Kytos 文档', property: 'og:title' }],
    [
      'meta',
      {
        content: '在一个本地优先的桌面工作区中创建角色、视觉资产、插画和故事。',
        property: 'og:description',
      },
    ],
  ],
  lang: 'zh-CN',
  lastUpdated: true,
  sitemap: {
    hostname: 'https://jujiuyey.github.io/Kytos/',
  },
  themeConfig: {
    darkModeSwitchLabel: '外观',
    darkModeSwitchTitle: '切换到深色模式',
    docFooter: {
      next: '下一页',
      prev: '上一页',
    },
    editLink: {
      pattern: 'https://github.com/JujiuYey/Kytos/edit/main/website/:path',
      text: '在 GitHub 上编辑此页',
    },
    footer: {
      copyright: 'Copyright © 2026 Kytos contributors',
      message: '基于 MIT License 发布',
    },
    lastUpdated: {
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
      text: '最后更新',
    },
    lightModeSwitchTitle: '切换到浅色模式',
    nav: [
      { link: '/getting-started/', text: '快速开始' },
      { link: '/guide/character', text: '使用指南' },
      { link: '/tutorial/', text: '相关技术教程' },
    ],
    outline: {
      label: '本页内容',
      level: [2, 3],
    },
    returnToTopLabel: '返回顶部',
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonAriaLabel: '搜索文档',
            buttonText: '搜索',
          },
          modal: {
            backButtonTitle: '关闭搜索',
            displayDetails: '显示详细列表',
            footer: {
              closeKeyAriaLabel: '关闭',
              closeText: '关闭',
              navigateDownKeyAriaLabel: '选择下一项',
              navigateText: '切换',
              navigateUpKeyAriaLabel: '选择上一项',
              selectKeyAriaLabel: '打开结果',
              selectText: '打开',
            },
            noResultsText: '没有找到相关内容',
            resetButtonTitle: '清除搜索',
          },
        },
      },
    },
    sidebar: [
      {
        items: [
          { link: '/getting-started/', text: '安装与首次启动' },
          { link: '/getting-started/providers', text: '模型与凭据' },
        ],
        text: '开始使用',
      },
      {
        items: [
          { link: '/guide/character', text: '角色与视觉资产' },
          { link: '/guide/illustration', text: '插画创作' },
          { link: '/guide/story', text: '故事与分镜' },
          { link: '/guide/workspace', text: '工作区与数据' },
          { link: '/guide/troubleshooting', text: '常见问题' },
        ],
        text: '使用指南',
      },
      {
        items: [
          { link: '/tutorial/', text: '教程导读与学习路线' },
          { link: '/tutorial/tailwind-shadcn', text: 'Tailwind CSS 与 shadcn-vue' },
          { link: '/tutorial/electron', text: 'Electron' },
          { link: '/tutorial/sqlite', text: 'SQLite' },
          { link: '/tutorial/ai-sdk', text: 'AI SDK' },
          { link: '/tutorial/ai-elements', text: 'AI Elements' },
          {
            items: [
              { link: '/developer/', text: '开发文档导读' },
              { link: '/developer/setup', text: '环境与命令' },
              {
                items: [
                  { link: '/developer/architecture/', text: '架构总览' },
                  { link: '/developer/architecture/ipc', text: 'IPC 契约' },
                  { link: '/developer/architecture/frontend', text: '前端边界' },
                  { link: '/developer/architecture/domain-model', text: '领域模型' },
                ],
                text: '系统架构',
              },
              {
                items: [
                  { link: '/developer/workflows/character', text: '角色工作流' },
                  { link: '/developer/workflows/illustration', text: '插画工作流' },
                  { link: '/developer/workflows/story', text: '故事工作流' },
                ],
                text: '领域流程',
              },
              {
                items: [
                  { link: '/developer/data/', text: '数据边界' },
                  { link: '/developer/data/migrations', text: '数据库与迁移' },
                ],
                text: '数据边界',
              },
              {
                items: [
                  { link: '/developer/ai/', text: 'AI 集成总览' },
                  { link: '/developer/ai/agents', text: 'Agent 执行' },
                  { link: '/developer/ai/image-generation', text: '图片生成' },
                  { link: '/developer/ai/providers', text: 'Provider 适配' },
                ],
                text: 'AI 集成',
              },
              {
                items: [
                  { link: '/developer/release/build', text: '构建' },
                  { link: '/developer/release/publish', text: '发布' },
                ],
                text: '构建与发布',
              },
            ],
            text: 'Kytos 开发文档',
          },
        ],
        text: '开发指南',
      },
    ],
    sidebarMenuLabel: '文档导航',
    socialLinks: [{ icon: 'github', link: 'https://github.com/JujiuYey/Kytos' }],
  },
  title: 'Kytos',
  titleTemplate: ':title | Kytos',
});
