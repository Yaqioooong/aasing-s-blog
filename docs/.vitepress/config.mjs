import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitepress'
import { inject } from '@vercel/analytics'
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  ogDate,
  pageUrl,
} from './og.mjs'

// 初始化 Vercel Analytics
inject()

// 由 scripts/og/generate.mjs 在 build 前生成；缺失时退回默认图。
function loadOgManifest() {
  try {
    return JSON.parse(
      readFileSync(new URL('./og-manifest.json', import.meta.url), 'utf8'),
    )
  } catch {
    return {}
  }
}

const ogManifest = loadOgManifest()

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: SITE_NAME,
  description: DEFAULT_DESCRIPTION,
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
  transformHead({ pageData }) {
    if (pageData.frontmatter?.og === false) return []

    const entry = ogManifest[pageData.relativePath]
    const title =
      entry?.title ||
      pageData.frontmatter?.title ||
      pageData.title ||
      SITE_NAME
    const description =
      entry?.description ||
      pageData.frontmatter?.description ||
      pageData.description ||
      DEFAULT_DESCRIPTION
    const shortDescription =
      [...description].length > 200
        ? [...description].slice(0, 199).join('') + '…'
        : description
    const image = entry?.image
      ? new URL(entry.image, SITE_URL).href
      : DEFAULT_OG_IMAGE
    const published = entry?.date || ogDate(pageData.frontmatter?.date)
    const isPost =
      pageData.relativePath.startsWith('posts/') &&
      pageData.relativePath !== 'posts/index.md'

    const tags = [
      ['meta', { property: 'og:type', content: isPost ? 'article' : 'website' }],
      ['meta', { property: 'og:site_name', content: SITE_NAME }],
      ['meta', { property: 'og:locale', content: 'zh_CN' }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: shortDescription }],
      ['meta', { property: 'og:url', content: pageUrl(pageData.relativePath) }],
      ['meta', { property: 'og:image', content: image }],
      ['meta', { property: 'og:image:width', content: '1200' }],
      ['meta', { property: 'og:image:height', content: '630' }],
      ['meta', { property: 'og:image:alt', content: title }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: shortDescription }],
      ['meta', { name: 'twitter:image', content: image }],
      ['meta', { name: 'twitter:image:alt', content: title }],
    ]

    if (published) {
      tags.push(['meta', { property: 'article:published_time', content: published }])
    }

    return tags
  },
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
      { text: 'Home', link: '/' },
      { text: 'Blogs', link: '/posts/' },
      { text: 'About', link: '/about' }
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
      copyright: 'Copyright © 2026-present Yaxing Guo Aka. Roy'
    },
    appearance: true
  }
})
