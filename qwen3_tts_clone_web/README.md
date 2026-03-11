# Qwen3-TTS Voice Clone Web Demo

一个最小可用的网页 demo：

- 第一步：上传参考音频，调用 DashScope 的 `Qwen3-TTS-VC` 官方 voice cloning API，拿到 `voice token`
- 第二步：输入文本，用同一个模型继续做语音合成

这个项目选的是 `FastAPI + 原生 HTML/CSS/JS`，因为它够薄、够直接，适合先跑通产品原型。

## 为什么这里走官方 API，而不是本地直接跑开源模型

你提到的是 `Qwen3-TTS`。官方现在有两条路：

- 开源本地模型：`QwenLM/Qwen3-TTS`
- 云端 API：阿里云 Model Studio / DashScope 的 `Qwen3-TTS-VC`

本地模型路线当然也能做，但它更偏工程环境：

- 需要 Python 3.12+
- 通常更适合有 GPU 的机器
- 本地 voice clone 模式常常还要给参考音频配对应的转写文本

而官方云端 `voice cloning` API 直接接受参考音频，更适合先做网页原型。

## 目录结构

```text
qwen3_tts_clone_web/
  app/
    main.py
    static/
      index.html
      styles.css
      app.js
  .env.example
  requirements.txt
```

## 本地运行

先确保你的机器有 Python 3.12+。当前这台环境里我没有发现可直接使用的 Python，所以代码已经搭好了，但我没法在这里实际启动它。

### 1. 创建虚拟环境

```powershell
cd E:\Windows\Codex\qwen3_tts_clone_web
python -m venv .venv
.venv\Scripts\Activate.ps1
```

### 2. 安装依赖

```powershell
pip install -r requirements.txt
```

### 3. 配置 API Key

你有两种方式：

- 简单方式：直接在网页里输入 `DashScope API Key`
- 稍微正规一点：复制 `.env.example` 为 `.env`，然后在系统环境变量里设置 `DASHSCOPE_API_KEY`

可选环境变量：

- `DASHSCOPE_API_KEY`
- `DASHSCOPE_REGION=international` 或 `mainland`
- `QWEN_VC_MODEL=qwen3-tts-vc-2026-01-22`

### 4. 启动服务

```powershell
uvicorn app.main:app --reload
```

启动后打开：

```text
http://127.0.0.1:8000
```

## 使用说明

### 样音建议

- 单人说话
- 10-20 秒左右
- 背景噪音尽量少
- 不要夹杂背景音乐
- 说话内容越清晰、越稳定，克隆效果通常越好

### 生成流程

1. 上传样音，创建 `voice token`
2. 把 `voice token` 保留下来
3. 输入文本
4. 生成音频并试听

## 关键后端接口

### `POST /api/clone-voice`

表单字段：

- `sample`: 参考音频
- `preferred_name`: 可选，voice 前缀名
- `target_model`: 默认 `qwen3-tts-vc-2026-01-22`
- `region`: `international` / `mainland`
- `api_key`: 可选，页面里临时输入的 key

### `POST /api/synthesize`

JSON 字段：

- `text`
- `voice`
- `model`
- `language_type`
- `region`
- `api_key`

## 注意事项

- 这个 demo 默认走后端代理，避免浏览器直接暴露 API Key
- 目前返回的是 DashScope 的音频 URL，通常是临时有效链接
- 只对你自己的声音，或已获得明确授权的声音做克隆

## 官方参考

- Qwen3-TTS 开源仓库：<https://github.com/QwenLM/Qwen3-TTS>
- 官方语音合成与 voice cloning 文档：<https://www.alibabacloud.com/help/en/model-studio/qwen-tts>
- 官方 voice cloning 文档：<https://www.alibabacloud.com/help/en/model-studio/qwen-tts-voice-cloning>
