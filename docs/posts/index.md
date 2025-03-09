---
title: 博客文章
description: 所有博客文章的列表展示
---

<script setup>
import { data } from './posts.data.js'
import { ref, computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vitepress'

const route = useRoute()
const router = useRouter()

// 获取当前页码
const currentPage = ref(1)
const isDataLoaded = ref(false)

// 监听路由变化和数据加载
watchEffect(() => {
  // 确保数据已加载
  if (!data || !data.posts || !data.totalPages) {
    isDataLoaded.value = false
    return
  }
  
  isDataLoaded.value = true
  const page = parseInt(route.query?.page) || 1
  currentPage.value = Math.min(Math.max(1, page), data.totalPages)
})

// 计算当前页的文章
const paginatedPosts = computed(() => {
  if (!isDataLoaded.value || !data || !data.posts || !data.pageSize) return []
  const start = (currentPage.value - 1) * data.pageSize
  const end = start + data.pageSize
  return data.posts.slice(start, end)
})

// 页码改变处理函数
const handlePageChange = (page) => {
  if (!isDataLoaded.value) return
  currentPage.value = page
  // 更新 URL
  router.replace({
    query: { ...route.query, page }
  })
}

const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}
</script>

<div class="blog-container">
  <!-- <h1 class="page-title">{{ $frontmatter.title }}</h1> -->
  <!-- <p class="page-desc">{{ $frontmatter.description }}</p> -->
  
  <div v-if="isDataLoaded" class="post-list">
    <div v-for="post in paginatedPosts" :key="post.url" class="post-item">
      <h1 class="post-title">
        <a :href="post.url">{{ post.frontmatter.title || '无标题' }}</a>
      </h1>
      <div class="post-meta">
        <div class="post-date" v-if="post.frontmatter.date">{{ formatDate(post.frontmatter.date) }}</div>
      </div>
      <p class="post-desc">{{ post.frontmatter.description || '暂无简介' }}</p>
      <div class="post-tags" v-if="post.frontmatter.tags">
        <span v-for="tag in post.frontmatter.tags" :key="tag" class="post-tag">{{ tag }}</span>
      </div>
    </div>
  </div>
  
  <div v-if="isDataLoaded && data.posts.length === 0" class="no-posts">
    <p>暂无文章</p>
  </div>
  
  <!-- 分页组件 -->
  <div class="pagination" v-if="isDataLoaded && data.totalPages >= 1">
    <button 
      class="page-btn" 
      :disabled="currentPage === 1"
      @click="handlePageChange(currentPage - 1)"
    >
      上一页
    </button>
    <button 
      v-for="page in data.totalPages" 
      :key="page"
      class="page-btn"
      :class="{ active: currentPage === page }"
      @click="handlePageChange(page)"
    >
      {{ page }}
    </button>
    <button 
      class="page-btn"
      :disabled="currentPage === data.totalPages"
      @click="handlePageChange(currentPage + 1)"
    >
      下一页
    </button>
  </div>

  <div v-if="!isDataLoaded" class="loading">
    <p>加载中...</p>
  </div>
</div>

<style>
.blog-container {
  max-width: 900px;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: var(--vp-c-text-1);
  text-align: left;
  letter-spacing: -0.02em;
}

.page-desc {
  font-size: 1.1rem;
  color: var(--vp-c-text-2);
  text-align: center;
  margin-bottom: 2rem;
}

.post-list {
  display: grid;
  gap: 0.05rem;
}

.post-item {
  /* border-bottom: 1px dashed var(--vp-c-divider); */
  transition: all 0.3s ease;
  padding: 0.5rem 0;
  border-bottom: 1px dashed var(--vp-c-divider);
}

.post-item:hover {
  transform: translateX(4px);
}

.post-title {
  margin: 0 0 0.2rem;
  font-size: 1.4rem !important;
  line-height: 1.3;
  font-weight: 800;
  font-family: "Noto Serif", "Source Han Serif SC", serif;
}


.post-title a {
  color: var(--vp-c-text-1);
  text-decoration: none;
  font-weight: 800;
  transition: color 0.2s;
}

.post-title a:hover {
  color: var(--vp-c-brand);
}

.post-meta {
  margin-bottom: 0.8rem;
}

.post-date {
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}

.post-desc {
  margin: 0 0 0.8rem;
  font-size: 0.95rem;
  line-height: 1.25;
  color: var(--vp-c-text-2);
}

.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.post-tag {
  font-size: 0.8rem;
  color: var(--vp-c-brand);
}

.post-tag::before {
  content: "#";
  margin-right: 0.1rem;
}

.no-posts {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--vp-c-text-2);
}

@media (max-width: 640px) {
  .blog-container {
    padding: 1rem;
  }

  .page-title {
    font-size: 2rem;
  }

  .post-title {
    font-size: 1.3rem;
  }

  .post-desc {
    font-size: 0.9rem;
  }
}

/* 分页样式 */
.pagination {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.page-btn {
  padding: 0.5rem 1rem;
  /* border: 1px solid var(--vp-c-divider); */
  background-color: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--vp-c-brand);
  color: var(--vp-c-brand);
}

.page-btn.active {
  background-color: var(--vp-c-brand);
  border-color: var(--vp-c-brand);
  color: white;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.loading {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--vp-c-text-2);
}
</style>