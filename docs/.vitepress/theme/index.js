import DefaultTheme from 'vitepress/theme'
import BlogList from './BlogList.vue'
import Layout from './Layout.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('BlogList', BlogList)
  }
}