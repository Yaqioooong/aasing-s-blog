#!/usr/bin/env node
/**
 * 为每个页面生成 1200×630 的分享图，并写入 docs/.vitepress/og-manifest.json。
 *
 * 用法：
 *   npm run docs:og
 *
 * 新增文章后重新跑一次即可；`npm run docs:build` 会自动先执行这一步。
 * 想换配色/排版，改 scripts/og/template.mjs。
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { Resvg } from '@resvg/resvg-js'
import {
  DEFAULT_DESCRIPTION,
  SITE_NAME,
  cleanText,
  ogDate,
  ogFileName,
} from '../../docs/.vitepress/og.mjs'
import { renderCard } from './template.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const DOCS_DIR = path.join(ROOT, 'docs')
const OUT_DIR = path.join(DOCS_DIR, 'public', 'og')
const MANIFEST = path.join(DOCS_DIR, '.vitepress', 'og-manifest.json')

const FONT_FILES = [
  path.join(HERE, 'fonts', 'NotoSansSC-Regular.ttf'),
  path.join(HERE, 'fonts', 'NotoSansSC-Bold.ttf'),
]

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '.vitepress' || entry.name === 'public' || entry.name === 'node_modules') continue
      files.push(...(await walk(full)))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full)
    }
  }
  return files
}

function firstHeading(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m)
  if (!match) return ''
  return match[1]
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim()
}

function titleFor(frontmatter, markdown) {
  if (frontmatter.title) return cleanText(frontmatter.title)
  if (frontmatter.hero?.name) return cleanText(frontmatter.hero.name) || SITE_NAME
  return cleanText(firstHeading(markdown)) || SITE_NAME
}

function descriptionFor(frontmatter) {
  return cleanText(frontmatter.description || DEFAULT_DESCRIPTION)
}

function eyebrowFor(frontmatter, relativePath) {
  if (relativePath === 'index.md') return 'WELCOME'
  if (relativePath === 'about.md') return 'ABOUT'
  if (relativePath === 'posts/index.md') return 'ARCHIVE'
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : []
  return tags.length ? tags.slice(0, 3).join(' · ') : 'NOTES'
}

function ctaFor(relativePath) {
  if (relativePath === 'index.md') return 'VISIT BLOG'
  if (relativePath === 'about.md') return 'ABOUT ME'
  if (relativePath === 'posts/index.md') return 'BROWSE POSTS'
  return 'READ ARTICLE'
}

function footerFor(frontmatter, relativePath) {
  if (relativePath === 'index.md') return 'Yaxing Guo'
  const date = ogDate(frontmatter.date)
  return date ? date.replaceAll('-', '.') : 'Yaxing Guo'
}

function subtitleFor(frontmatter, relativePath) {
  if (relativePath === 'index.md') {
    return cleanText(frontmatter.hero?.text || frontmatter.hero?.tagline || 'Learning & Sharing')
  }
  return ''
}

async function toPng(svg) {
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: 'Noto Sans SC OG',
    },
  })
  return resvg.render().asPng()
}

async function main() {
  const files = (await walk(DOCS_DIR)).sort()
  await fs.mkdir(OUT_DIR, { recursive: true })

  // 只清理上次生成的哈希图，保留用户自己放进 public/og 的图片。
  const existing = await fs.readdir(OUT_DIR).catch(() => [])
  await Promise.all(
    existing
      .filter((name) => /^[0-9a-f]{10}\.png$/.test(name))
      .map((name) => fs.unlink(path.join(OUT_DIR, name))),
  )

  const manifest = {}

  // 默认图：没有单独生成图的页面（例如 404）兜底使用。
  const defaultSvg = renderCard({
    title: SITE_NAME,
    subtitle: 'Learning & Sharing',
    eyebrow: 'WELCOME',
    footerLeft: 'blog.aasing.com',
    cta: 'VISIT BLOG',
  })
  await fs.writeFile(path.join(OUT_DIR, 'default.png'), await toPng(defaultSvg))

  for (const file of files) {
    const relativePath = path.relative(DOCS_DIR, file).split(path.sep).join('/')
    const raw = await fs.readFile(file, 'utf8')
    const { data: frontmatter, content } = matter(raw)

    if (frontmatter.og === false) continue

    const title = titleFor(frontmatter, content)
    const description = descriptionFor(frontmatter)
    const customImage = frontmatter.ogImage

    let image = customImage
    if (!image) {
      const svg = renderCard({
        title,
        subtitle: subtitleFor(frontmatter, relativePath),
        eyebrow: eyebrowFor(frontmatter, relativePath),
        footerLeft: footerFor(frontmatter, relativePath),
        cta: ctaFor(relativePath),
      })
      const fileName = ogFileName(relativePath, {
        ...frontmatter,
        title: frontmatter.title || title,
      })
      await fs.writeFile(path.join(OUT_DIR, fileName), await toPng(svg))
      image = `/og/${fileName}`
    }

    manifest[relativePath] = {
      title,
      description,
      date: ogDate(frontmatter.date),
      image,
    }
    console.log(`og: ${relativePath} -> ${image}`)
  }

  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`\nGenerated ${Object.keys(manifest).length} cards + default.png`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
