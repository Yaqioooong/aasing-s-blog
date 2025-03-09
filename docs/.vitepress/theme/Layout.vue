<script setup>
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import Comment from './Comment.vue'

const { Layout } = DefaultTheme
const { page } = useData()
</script>

<template>
  <Layout>
    <template #doc-after>
      <Comment v-if="page.relativePath.startsWith('posts/') && !page.relativePath.endsWith('index.md')" />
    </template>
  </Layout>
</template>