import { cleanText } from '../../docs/.vitepress/og.mjs'

const WIDTH = 1200
const HEIGHT = 630
const PADDING = 80
const CONTENT_WIDTH = WIDTH - PADDING * 2
const FONT_FAMILY = 'Noto Sans SC OG'

const GREEN = '#7ee2b8'
const INK = '#f8fafc'
const MUTED = '#94a3b8'

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function isCjk(ch) {
  return /[\u2E80-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/u.test(ch)
}

function charWidth(ch) {
  if (ch === ' ') return 0.28
  if (isCjk(ch)) return 1
  if (/[A-Z]/.test(ch)) return 0.66
  if (/[a-z]/.test(ch)) return 0.53
  if (/[0-9]/.test(ch)) return 0.58
  return 0.45
}

function measure(text, fontSize) {
  let units = 0
  for (const ch of text) units += charWidth(ch)
  return units * fontSize
}

function tokenize(text) {
  // CJK 逐字断行，英文按单词断行，避免把 LangGraph / PostgreSQL 拆开。
  return text.match(/[A-Za-z0-9][A-Za-z0-9'’._:+\-/]*|\s+|./gsu) || []
}

function wrapText(text, fontSize, maxWidth) {
  const lines = []
  let line = ''

  for (const token of tokenize(text)) {
    if (!line && token === ' ') continue

    const candidate = line + token
    if (measure(candidate, fontSize) <= maxWidth) {
      line = candidate
      continue
    }

    if (line) {
      lines.push(line.trimEnd())
      line = token === ' ' ? '' : token
      continue
    }

    // 单个英文长词本身就超宽时，只能按字符硬切。
    let chunk = ''
    for (const ch of token) {
      if (chunk && measure(chunk + ch, fontSize) > maxWidth) {
        lines.push(chunk)
        chunk = ch
      } else {
        chunk += ch
      }
    }
    line = chunk
  }

  if (line.trim()) lines.push(line.trimEnd())
  return lines
}

function fitTitle(title) {
  for (const fontSize of [72, 66, 60, 54, 48]) {
    const lines = wrapText(title, fontSize, CONTENT_WIDTH)
    if (lines.length > 3) continue
    // 避免最后一行只剩一两个字，看起来像被挤下去的。
    if (lines.length > 1 && measure(lines.at(-1), fontSize) < fontSize * 2.2) continue
    return { fontSize, lines }
  }

  const allLines = wrapText(title, 44, CONTENT_WIDTH)
  const lines = allLines.slice(0, 3)
  if (allLines.length > 3 || (lines.length === 3 && measure(lines.at(-1), 44) < 44 * 2.2)) {
    lines[2] += '…'
  }
  return { fontSize: 44, lines }
}

function ellipsis(text, max) {
  const chars = [...text]
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : text
}

export function renderCard({
  title,
  subtitle = '',
  eyebrow = 'NOTES',
  footerLeft = 'blog.aasing.com',
  cta = 'READ ARTICLE',
}) {
  const safeTitle = cleanText(title) || "Roy's Blog"
  const { fontSize, lines } = fitTitle(safeTitle)
  const lineHeight = Math.round(fontSize * 1.24)
  const blockHeight = lines.length * lineHeight
  const titleTop = 214 + Math.max(0, (500 - 214 - blockHeight) / 2)
  const firstBaseline = titleTop + fontSize * 0.86
  const titleBaselines = lines.map((_, index) => firstBaseline + index * lineHeight)
  const lastBaseline = titleBaselines.at(-1)

  const safeSubtitle = ellipsis(cleanText(subtitle), 46)
  const showSubtitle = Boolean(safeSubtitle) && lines.length <= 2
  const subtitleY = lastBaseline + 66

  const eyebrowText = ellipsis(cleanText(eyebrow).toUpperCase(), 48)
  const footerText = ellipsis(cleanText(footerLeft), 32)
  const ctaText = cleanText(cta).toUpperCase()

  const titleSvg = lines
    .map(
      (line, index) =>
        `<text x="${PADDING}" y="${titleBaselines[index]}" font-family="${FONT_FAMILY}" font-size="${fontSize}" font-weight="700" fill="${INK}">${escapeXml(line)}</text>`,
    )
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a1120"/>
      <stop offset="0.62" stop-color="#0d1729"/>
      <stop offset="1" stop-color="#0b1a26"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.88" cy="0.04" r="0.78">
      <stop offset="0" stop-color="#3eaf7c" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#3eaf7c" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="#ffffff" stroke-opacity="0.035" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>

  <circle cx="1150" cy="650" r="260" fill="none" stroke="#3eaf7c" stroke-opacity="0.10" stroke-width="1.5"/>
  <circle cx="1150" cy="650" r="180" fill="none" stroke="#3eaf7c" stroke-opacity="0.07" stroke-width="1.5"/>

  <circle cx="86" cy="78" r="6" fill="#3eaf7c"/>
  <text x="102" y="86" font-family="${FONT_FAMILY}" font-size="20" font-weight="700" letter-spacing="3.6" fill="#cbd5e1">ROY&apos;S BLOG</text>
  <text x="${WIDTH - PADDING}" y="86" text-anchor="end" font-family="${FONT_FAMILY}" font-size="19" fill="#64748b" letter-spacing="0.4">blog.aasing.com</text>

  <path d="M${PADDING} 124H${WIDTH - PADDING}" stroke="#ffffff" stroke-opacity="0.09"/>

  <text x="${PADDING}" y="196" font-family="${FONT_FAMILY}" font-size="20" font-weight="500" letter-spacing="2.4" fill="${GREEN}">${escapeXml(eyebrowText)}</text>

  ${titleSvg}
  ${
    showSubtitle
      ? `<text x="${PADDING}" y="${subtitleY}" font-family="${FONT_FAMILY}" font-size="30" fill="${MUTED}">${escapeXml(safeSubtitle)}</text>`
      : ''
  }

  <path d="M${PADDING} 512H${WIDTH - PADDING}" stroke="#ffffff" stroke-opacity="0.09"/>

  <circle cx="86" cy="550" r="4" fill="#3eaf7c"/>
  <text x="102" y="558" font-family="${FONT_FAMILY}" font-size="22" fill="${MUTED}">${escapeXml(footerText)}</text>

  <text x="1078" y="558" text-anchor="end" font-family="${FONT_FAMILY}" font-size="19" letter-spacing="2.4" fill="${GREEN}">${escapeXml(ctaText)}</text>
  <path d="M1094 551h18m-6-6 6 6-6 6" fill="none" stroke="#3eaf7c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
}

export const OG_WIDTH = WIDTH
export const OG_HEIGHT = HEIGHT
