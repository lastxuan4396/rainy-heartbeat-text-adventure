# 内容站模板（升级版）

## 目录

- `index.html`：页面内容结构（你主要改这里）
- `styles.css`：视觉样式
- `script.js`：滚动动效、导航高亮、年份自动更新
- `detail.css`：详情页样式
- `posts/`、`projects/`、`games/`：详情页内容
- `robots.txt`、`sitemap.xml`、`site.webmanifest`：SEO/PWA 基础文件

## 你只需要改这几块

1. `index.html` 的联系方式  
当前已设置邮箱 `1750429451@qq.com`、微信 `milkpad`，可按需修改。

2. `posts/`、`projects/`、`games/` 的文案  
首页卡片已经连到这些详情页，直接在对应文件里改正文就行。

3. `script.js` 的统计配置（可选）  
文件顶部 `analyticsConfig` 支持 Plausible 或 GA4，填入 ID 即可生效。

4. 部署域名同步  
当前 SEO 地址使用 `https://is.gd/dianjidefanplus2`，若换域名请同步更新 `index.html`、`robots.txt`、`sitemap.xml`。

## 本地预览

直接双击打开 `index.html`，或用你喜欢的本地服务器打开该目录。

## 视觉快速改法

如果你想换整体风格，改 `styles.css` 顶部的变量：

- `--primary`：主按钮色
- `--accent`：链接和强调色
- `--bg` / `--surface`：背景和卡片底色

## 下一步建议

- 先填 3 条想法 + 2 个网页作品 + 1 个游戏作品
- 每周固定更新一次，把这个站当作你的公开成长记录
- 尽快绑定自己的域名（建议与“垫饥的饭”品牌一致）
