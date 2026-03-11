from __future__ import annotations

import base64
import mimetypes
import os
import uuid
from pathlib import Path
from typing import Literal

import requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
load_dotenv(BASE_DIR.parent / ".env")
DEFAULT_REGION = os.getenv("DASHSCOPE_REGION", "international")
DEFAULT_MODEL = os.getenv("QWEN_VC_MODEL", "qwen3-tts-vc-2026-01-22")
MAX_SAMPLE_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"}
REGION_BASE_URLS = {
    "international": "https://dashscope-intl.aliyuncs.com",
    "mainland": "https://dashscope.aliyuncs.com",
}


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=3000)
    voice: str = Field(min_length=1)
    model: str = Field(default=DEFAULT_MODEL, min_length=1)
    language_type: Literal["Chinese", "English", "Auto"] = "Chinese"
    region: Literal["international", "mainland"] = DEFAULT_REGION  # type: ignore[assignment]
    api_key: str | None = None


app = FastAPI(title="Qwen3-TTS Voice Clone Web Demo")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


def get_api_key(override: str | None) -> str:
    api_key = (override or os.getenv("DASHSCOPE_API_KEY") or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="缺少 API Key。请在页面输入，或在环境变量里设置 DASHSCOPE_API_KEY。",
        )
    return api_key


def get_base_url(region: str) -> str:
    try:
        return REGION_BASE_URLS[region]
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=f"不支持的 region: {region}") from exc


def build_audio_data_uri(audio_bytes: bytes, mime_type: str) -> str:
    encoded = base64.b64encode(audio_bytes).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def extract_error_detail(response: requests.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text.strip() or f"HTTP {response.status_code}"

    pieces = []
    for key in ("message", "code", "request_id"):
        value = payload.get(key)
        if value:
            pieces.append(f"{key}: {value}")

    output = payload.get("output")
    if isinstance(output, dict):
        for key in ("message", "code"):
            value = output.get(key)
            if value:
                pieces.append(f"output.{key}: {value}")

    return " | ".join(pieces) or f"HTTP {response.status_code}"


def dashscope_post(*, region: str, api_key: str, path: str, payload: dict, timeout: int = 180) -> dict:
    response = requests.post(
        f"{get_base_url(region)}{path}",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=timeout,
    )

    if not response.ok:
        raise HTTPException(
            status_code=502,
            detail=f"DashScope 请求失败：{extract_error_detail(response)}",
        )

    try:
        return response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="DashScope 返回了非 JSON 响应。") from exc


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.post("/api/clone-voice")
async def clone_voice(
    sample: UploadFile = File(...),
    preferred_name: str = Form(""),
    target_model: str = Form(DEFAULT_MODEL),
    region: Literal["international", "mainland"] = Form(DEFAULT_REGION),  # type: ignore[assignment]
    consent: bool = Form(False),
    api_key: str | None = Form(None),
) -> dict:
    if not consent:
        raise HTTPException(status_code=400, detail="请先确认你拥有该声音的合法授权。")

    if not target_model.strip():
        raise HTTPException(status_code=400, detail="target_model 不能为空。")

    audio_bytes = await sample.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="请先上传一段参考音频。")
    if len(audio_bytes) > MAX_SAMPLE_BYTES:
        raise HTTPException(status_code=400, detail="参考音频太大了，请控制在 10MB 以内。")

    extension = Path(sample.filename or "").suffix.lower()
    if extension and extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="只支持 wav/mp3/m4a/aac/flac/ogg。")

    mime_type = sample.content_type or mimetypes.guess_type(sample.filename or "")[0] or "audio/wav"
    prefix = preferred_name.strip() or f"web-demo-{uuid.uuid4().hex[:8]}"
    payload = {
        "target_model": target_model.strip(),
        "prefix": prefix,
        "url": build_audio_data_uri(audio_bytes, mime_type),
    }
    data = dashscope_post(
        region=region,
        api_key=get_api_key(api_key),
        path="/api/v1/customization/voices",
        payload=payload,
        timeout=180,
    )

    output = data.get("output") or {}
    voice = output.get("voice")
    if not voice:
        raise HTTPException(status_code=502, detail="DashScope 响应里没有 voice 字段。")

    return {
        "voice": voice,
        "prefix": prefix,
        "target_model": output.get("target_model", target_model.strip()),
        "request_id": data.get("request_id"),
    }


@app.post("/api/synthesize")
def synthesize(request: SynthesizeRequest) -> dict:
    payload = {
        "model": request.model.strip(),
        "input": {
            "text": request.text.strip(),
            "voice": request.voice.strip(),
            "language_type": request.language_type,
        },
    }
    data = dashscope_post(
        region=request.region,
        api_key=get_api_key(request.api_key),
        path="/api/v1/services/aigc/multimodal-generation/generation",
        payload=payload,
        timeout=300,
    )

    output = data.get("output") or {}
    audio = output.get("audio") or {}
    audio_url = audio.get("url")
    if not audio_url:
        raise HTTPException(status_code=502, detail="DashScope 响应里没有音频 URL。")

    return {
        "audio_url": audio_url,
        "request_id": data.get("request_id"),
        "voice": request.voice.strip(),
        "model": request.model.strip(),
    }
