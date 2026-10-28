import { createHash } from 'node:crypto'

export const SITE_URL = 'https://blog.aasing.com'
export const SITE_NAME = "Roy's Blog"
export const DEFAULT_DESCRIPTION = '记录学习和生活'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og/default.png`
// 改模板/配色/字体后把版本号 +1，图片 URL 会自动变化并绕过 X 的旧缓存。
export const OG_VERSION = '1'

// 只保留文字内容，避免 emoji / 零宽字符进入 SVG 后变成缺字方块。
const UNSUPPORTED = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200B}-\u{200D}]/gu

export function cleanText(value) {
  return String(value ?? '')
    .replace(UNSUPPORTED, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function ogTitle(pageData) {
  const fm = pageData.frontmatter || {}
  if (fm.title) return cleanText(fm.title)
  if (fm.hero?.name) return cleanText(fm.hero.name) || SITE_NAME
  return cleanText(pageData.title) || SITE_NAME
}

export function ogDescription(pageData) {
  const fm = pageData.frontmatter || {}
  return cleanText(fm.description || pageData.description || DEFAULT_DESCRIPTION)
}

export function ogDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export function pagePath(relativePath) {
  // VitePress 默认构建出 .html；如果以后开启 cleanUrls，去掉最后一行 replace 即可。
  return (
    '/' +
    relativePath
      .replace(/(^|\/)index\.md$/, '$1')
      .replace(/\.md$/, '.html')
  )
}

export function pageUrl(relativePath) {
  return new URL(pagePath(relativePath), SITE_URL).href
}

function ogHashInput(relativePath, frontmatter = {}) {
  return [
    OG_VERSION,
    relativePath,
    cleanText(frontmatter.title || frontmatter.hero?.name),
    cleanText(frontmatter.hero?.text || frontmatter.hero?.tagline),
    ogDate(frontmatter.date),
    (frontmatter.tags || []).join('|'),
  ].join('\u0000')
}

// 图片名带上内容指纹：标题/日期/标签变化后 URL 也会变，X 不会继续用旧缓存。
export function ogFileName(relativePath, frontmatter = {}) {
  const hash = createHash('sha1')
    .update(ogHashInput(relativePath, frontmatter))
    .digest('hex')
    .slice(0, 10)
  return `${hash}.png`
}

export function ogImageUrl(pageData) {
  const custom = pageData.frontmatter?.ogImage
  if (custom) return new URL(custom, SITE_URL).href
  return `${SITE_URL}/og/${ogFileName(pageData.relativePath, pageData.frontmatter)}`
}

export function ogDisabled(pageData) {
  return pageData.frontmatter?.og === false
}
