<script setup>
import { ref, onMounted, watchEffect } from 'vue'
import { useData } from 'vitepress'

const { isDark } = useData()

const giscusTheme = ref('light')

// 监听主题变化
watchEffect(() => {
  giscusTheme.value = isDark.value ? 'dark' : 'light'
  const iframe = document.querySelector('.giscus-frame')
  if (iframe) {
    iframe.contentWindow.postMessage(
      {
        giscus: {
          setConfig: {
            theme: giscusTheme.value
          }
        }
      },
      'https://giscus.app'
    )
  }
})

onMounted(() => {
  // 加载 Giscus
  const script = document.createElement('script')
  script.src = 'https://giscus.app/client.js'
  script.setAttribute('data-repo', 'Yaqioooong/aasing-s-blog') 
  script.setAttribute('data-repo-id', 'R_kgDOOE10Qg') // TODO: 替换为你的仓库ID
  script.setAttribute('data-category', 'General') // 使用的Discussion分类
  script.setAttribute('data-category-id', 'DIC_kwDOOE10Qs4Cnvqj') // TODO: 替换为分类ID
  script.setAttribute('data-mapping', 'pathname')
  script.setAttribute('data-strict', '0')
  script.setAttribute('data-reactions-enabled', '1')
  script.setAttribute('data-emit-metadata', '0')
  script.setAttribute('data-input-position', 'bottom')
  script.setAttribute('data-theme', giscusTheme.value)
  script.setAttribute('data-lang', 'zh-CN')
  script.crossOrigin = 'anonymous'
  script.async = true
  document.body.appendChild(script)
})
</script>

<template>
  <div class="giscus-container">
    <div class="giscus"></div>
  </div>
</template>

<style>
.giscus-container {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--vp-c-divider);
}
</style>