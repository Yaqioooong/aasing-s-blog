import { createContentLoader } from 'vitepress'

export default createContentLoader('./posts/*.md', {
  transform(raw) {
    return raw
      .filter(page => page.url !== '/posts/')
      .sort((a, b) => {
        return +new Date(b.frontmatter.date || 0) - +new Date(a.frontmatter.date || 0)
      })
  }
})