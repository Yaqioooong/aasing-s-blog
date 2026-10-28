# 分享图（Open Graph Image）

为每个页面生成 1200×630 的分享图，发到 X / Telegram / Slack 等平台时会显示对应文章的卡片。

## 使用

```bash
npm run docs:og     # 只生成图片和 manifest
npm run docs:build  # 会先自动执行 docs:og，再构建站点
```

生成结果：

- `docs/public/og/<10 位 hash>.png`：每页一张，URL 带内容指纹
- `docs/.vitepress/og-manifest.json`：页面路径 → 标题/描述/日期/图片的映射，`config.mjs` 在构建时读取它来输出 `og:*` 和 `twitter:*`

## 新增文章

frontmatter 的 `title`、`description`、`date`、`tags` 会自动进入图片和 meta，无需手动配置。

需要覆盖分享图时：

```yaml
ogImage: /og/my-custom.png
```

不需要分享卡片时：

```yaml
og: false
```

## 修改样式

排版、配色、背景都在 `scripts/og/template.mjs`。改完样式后，把 `docs/.vitepress/og.mjs` 里的 `OG_VERSION` 加 1，图片文件名会变化，避免 X 继续使用旧缓存。

## 字体

`fonts/` 下是 Noto Sans SC 的子集（Regular / Bold），只用于生成图片，不会进入站点 bundle。授权见 `fonts/OFL.txt`（SIL Open Font License 1.1）。

当前子集覆盖约 7900 个常用字；如果新文章标题里有生僻字，生成图可能缺字，换成完整版 Noto Sans SC 即可。
