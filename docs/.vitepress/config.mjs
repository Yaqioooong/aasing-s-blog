import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "AaSing's Blog",
  description: "记录学习和生活",
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap' }],
    ['style', {}, `
      .VPNavBarTitle .title {
        font-family: 'Great Vibes', cursive;
        font-size: 1.5em;
        font-weight: 800;
        letter-spacing: 0.03em;
      }
    `]
  ],
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    search: {
      provider: 'local'
    },
    nav: [
      { text: '首页', link: '/' },
      { text: '博客', link: '/posts/' },
      { text: '关于', link: '/about' }
    ],

    sidebar: {
      // 移除 /posts/ 路径的侧边栏配置
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Yaqioooong' },
    ],

    footer: {
      message: '基于 VitePress 构建',
      copyright: 'Copyright © 2024-present Yaxing_Guo'
    },

    appearance: true
  }
})
