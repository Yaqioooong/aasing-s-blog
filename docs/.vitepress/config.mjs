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
    // 启用文章页面的右侧导航栏
    outline: {
      level: [2, 3],
      label: '目录'
    },
    nav: [
      { text: '首页', link: '/' },
      { text: '博客', link: '/posts/' },
      { text: '关于', link: '/about' }
    ],
    // lastUpdated: {
    //   text: '最后更新于',
    //   formatOptions: {
    //     dateStyle: 'full',
    //     timeStyle: 'medium'
    //   }
    // },
    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },
    sidebar: {
      // 移除 /posts/ 路径的侧边栏配置
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Yaqioooong' },
      {
        icon: {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path d="M6.503 20.752c0 1.794-1.456 3.248-3.251 3.248-1.796 0-3.252-1.454-3.252-3.248 0-1.794 1.456-3.248 3.252-3.248 1.795.001 3.251 1.454 3.251 3.248zm-6.503-12.572v4.811c6.05.062 10.96 4.966 11.022 11.009h4.817c-.062-8.71-7.118-15.758-15.839-15.82zm0-3.368c10.58.046 19.152 8.594 19.183 19.188h4.817c-.03-13.231-10.755-23.954-24-24v4.812z"/></svg>'
        },
        link: '/feed.xml',
        ariaLabel: 'RSS Feed'
      }
    ],
    footer: {
      message: 'Powered by VitePress',
      copyright: 'Copyright © 2025-present Yaxing_Guo'
    },
    appearance: true
  }
})
