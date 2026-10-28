<script setup>
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import Comment from './Comment.vue'

const { Layout } = DefaultTheme
const { page } = useData()

let footerObserver
let footerEl

// 把 footer 的实际高度同步给 CSS，右侧目录据此在 footer 上方收尾
function syncFooterHeight() {
  if (typeof document === 'undefined' || !footerEl) return
  document.documentElement.style.setProperty(
    '--vp-footer-height',
    `${footerEl.offsetHeight}px`
  )
}

function observeFooter() {
  if (typeof document === 'undefined') return
  footerObserver?.disconnect()
  footerEl = document.querySelector('.VPFooter')

  if (!footerEl) {
    // 没有 footer 时不需要给目录预留空间
    document.documentElement.style.setProperty('--vp-footer-height', '0px')
    return
  }

  if (typeof ResizeObserver !== 'undefined') {
    footerObserver = new ResizeObserver(syncFooterHeight)
    footerObserver.observe(footerEl)
  }
  syncFooterHeight()
}

onMounted(async () => {
  await nextTick()
  observeFooter()
})

watch(
  () => page.value.relativePath,
  async () => {
    await nextTick()
    observeFooter()
  }
)

onBeforeUnmount(() => {
  footerObserver?.disconnect()
  if (typeof document !== 'undefined') {
    document.documentElement.style.removeProperty('--vp-footer-height')
  }
})
</script>

<template>
  <Layout>
    <template #doc-after>
      <Comment v-if="page.relativePath.startsWith('posts/') && !page.relativePath.endsWith('index.md')" />
    </template>
  </Layout>
</template>