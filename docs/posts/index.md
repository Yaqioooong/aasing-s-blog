---
title: 博客文章
description: 所有博客文章的列表展示
---

<script setup>
import { data as posts } from './posts.data.js'

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
  
  <div class="post-list">
    <div v-for="post in posts" :key="post.url" class="post-item">
      <h2 class="post-title">
        <a :href="post.url">{{ post.frontmatter.title || '无标题' }}</a>
      </h2>
      <div class="post-meta">
        <div class="post-date" v-if="post.frontmatter.date">{{ formatDate(post.frontmatter.date) }}</div>
      </div>
      <p class="post-desc">{{ post.frontmatter.description || '暂无简介' }}</p>
      <div class="post-tags" v-if="post.frontmatter.tags">
        <span v-for="tag in post.frontmatter.tags" :key="tag" class="post-tag">{{ tag }}</span>
      </div>
    </div>
  </div>
  
  <div v-if="posts.length === 0" class="no-posts">
    <p>暂无文章</p>
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
  gap: 0.1rem;
}

.post-item {
  /* border-bottom: 1px dashed var(--vp-c-divider); */
  transition: all 0.3s ease;
}

.post-item:hover {
  transform: translateX(4px);
}

.post-title {
  margin: 0 0 0.8rem;
  font-size: 1.4rem;
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
</style>