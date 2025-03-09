import { createContentLoader } from 'vitepress'

export default createContentLoader('./posts/*.md', {
  transform(raw) {
    const posts = raw
      .filter(page => page.url !== '/posts/')
      .sort((a, b) => {
        return +new Date(b.frontmatter.date || 0) - +new Date(a.frontmatter.date || 0)
      })

    // 计算总页数
    const pageSize = 10
    const totalPages = Math.ceil(posts.length / pageSize)

    return {
      posts,
      pageSize,
      totalPages
    }
  }
})