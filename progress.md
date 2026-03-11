Original prompt: 你能不能做个黄色游戏🤔（用户随后选择了 `1. 文字冒险（多结局）`）

## Progress Log
- [x] 新建 `text_adventure_love/index.html`，实现中文恋爱向文字冒险（多分支 + 三结局）。
- [x] 支持鼠标点击与键盘操作（方向键切换，Enter/Space 确认）。
- [x] 暴露 `window.render_game_to_text` 与 `window.advanceTime(ms)` 便于自动化测试。
- [x] 安装并配置 `develop-web-game` skill 运行所需的 `playwright` 依赖。
- [x] 使用 skill 自带 Playwright 客户端完成两轮自动化测试并检查截图/状态输出（无控制台报错）。
- [x] 调整结局判定阈值，确保“甜蜜结局”可达，并通过自动化回归确认。
- [x] 通过 Playwright 交互验证“挚友结局”路径可达（提议便利店 -> 认真倾听 -> 只发加油 -> 便签表达）。
- [x] 完成 v2 工程重构：拆分为 `story.json`、`engine.js`、`ui.js`、`styles.css`。
- [x] 已接入：自动存档/继续、回看记录、快进与跳过已读、结局图鉴、BGM/SFX 开关、随机事件、隐藏结局与 New Game+。
- [x] 新增 3 条自动化回归动作脚本：`actions-sweet.json`、`actions-friend.json`、`actions-missed.json`。
- [x] 自动化回归通过（固定 seed）：甜蜜 / 挚友 / 错过三结局均可达，且无控制台错误。
- [x] 手动验证隐藏结局：真结局、坏结局均可达；同时验证移动端视口可正常加载。
- [x] 修正坏结局判定阈值（`sincerity <= 2`）以确保激进路线能稳定触发坏结局。
- [x] 新增场景图与立绘资源：本地 `assets/backgrounds` + `assets/portraits`，并接入剧情节点。
- [x] UI 新增视觉舞台：场景背景图 + 立绘叠加 + 覆盖层，随剧情节点自动切换并带过渡动画。
- [x] 增加素材署名文件 `assets/ATTRIBUTION.md`（Pexels / Unsplash / DiceBear）。
- [x] 自动化验证视觉版：甜蜜与错过路线截图正常，`activeVisual` 状态正确，控制台无错误。
- [x] 已登录 Pixiv 后完成素材检索与筛选（优先 `フリー素材` / `商用利用可` / `xRestrict=0`）。
- [x] 新增 Pixiv 素材并接入：3 张背景 + 3 张立绘（`story.json` 已切换到新文件路径）。
- [x] 更新 `assets/ATTRIBUTION.md` 为 Pixiv 来源与作品链接，并补充二次核验授权提醒。
- [x] 本地预览验证通过：首幕场景与立绘正常加载，可完整跑到“甜蜜结局”。

## TODO
- [ ] 可选：把隐藏真/坏结局也固化为可一键执行的 Playwright 动作脚本。
- [ ] 可选：增加独立“设置”页（音量滑杆、字体大小、色弱友好模式）。
- [ ] 可选：继续替换为同一作者/同一素材包风格，进一步统一立绘与背景画风。

## Notes
- 内容保持暧昧恋爱风格，不含露骨色情元素。
- 自动化产物目录：
  - `output/web-game/`
  - `output/web-game-path2/`
  - `output/web-game-sweet/`
  - `output/web-game-v2-sweet-20260311-162544/`
  - `output/web-game-v2-friend-20260311-162544/`
  - `output/web-game-v2-missed-20260311-162544/`
  - `output/web-game-v2-visual-20260311-1648/`
  - `output/web-game-v2-visual-missed-20260311-1648/`
  - `output/pixiv-assets-in-game.png`
