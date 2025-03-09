<script setup>
import { ref, computed } from 'vue'
import { useData } from 'vitepress'
import { data as posts } from '../../posts/posts.data.js'

const { theme } = useData()

// 每页显示的文章数量
const pageSize = 10
// 当前页码
const currentPage = ref(1)

// 计算总页数
const totalPages = computed(() => Math.ceil(posts.length / pageSize))

// 计算当前页显示的文章
const currentPosts = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return posts.slice(start, end)
})

// 页码变化处理
const handlePageChange = (page) => {
  currentPage.value = page
}

// 格式化日期
const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}
</script>

<template>
  <div class="blog-list">
    <!-- 文章列表 -->
    <div class="posts">
      <div v-for="post in currentPosts" :key="post.url" class="post-item">
        <h1 class="post-title">
          <a :href="post.url">{{ post.frontmatter.title || '无标题' }}</a>
        </h1>
        <div class="post-meta">
          <time class="post-date" v-if="post.frontmatter.date">{{ formatDate(post.frontmatter.date) }}</time>
        </div>
        <p class="post-description">{{ post.frontmatter.description || '暂无简介' }}</p>
        <div class="post-tags" v-if="post.frontmatter.tags">
          <span v-for="tag in post.frontmatter.tags" :key="tag" class="post-tag">{{ tag }}</span>
        </div>
      </div>
    </div>

    <!-- 分页导航 -->
    <div class="pagination" v-if="totalPages > 1">
      <button 
        :disabled="currentPage === 1"
        @click="handlePageChange(currentPage - 1)"
        class="page-btn"
      >
        上一页
      </button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button 
        :disabled="currentPage === totalPages"
        @click="handlePageChange(currentPage + 1)"
        class="page-btn"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<style scoped>
.blog-list {
  padding: 0.5rem 0;
}

.post-item {
  /* border: 1px solid var(--vp-c-divider); */
  border-bottom: 1px dashed var(--vp-c-divider);
  transition: all 0.3s;
}

.post-item:hover {
  transform: translateX(4px);
}

.blog-list .posts .post-item .post-title {
  margin: 0 0 0.2rem !important;
  font-size: 1.4rem !important;
  line-height: 1.3 !important;
  font-weight: 900 !important;
  font-family: "Noto Serif", "Source Han Serif SC", serif !important;
}

.post-title a {
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: color 0.2s;
}

.post-title a:hover {
  color: var(--vp-c-brand);
}

.post-meta {
  margin-bottom: 0.8rem;
}

.post-date {
  display: inline-block;
  font-size: 0.1rem;
  color: var(--vp-c-text-2);
}

.post-description {
  margin: 0 0 1rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
  font-size: 0.95rem;
}

.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.post-tag {
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
}

.post-tag::before {
  content: "#";
  margin-right: 0.1rem;
}



.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 2rem;
  gap: 1rem;
}

.page-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: transparent;
  color: var(--vp-c-text-1);
  cursor: pointer;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-btn:not(:disabled):hover {
  border-color: var(--vp-c-brand);
  color: var(--vp-c-brand);
}

.page-info {
  color: var(--vp-c-text-2);
}
</style>