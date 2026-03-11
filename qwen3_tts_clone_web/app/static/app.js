const cloneForm = document.querySelector("#clone-form");
const synthForm = document.querySelector("#synthesize-form");
const statusBox = document.querySelector("#status");
const requestIdInput = document.querySelector("#request-id");
const lastVoiceInput = document.querySelector("#last-voice");
const voiceTokenInput = document.querySelector("#voice-token");
const audioPlayer = document.querySelector("#audio-player");
const downloadLink = document.querySelector("#download-link");
const cloneButton = document.querySelector("#clone-button");
const synthButton = document.querySelector("#synthesize-button");

function setStatus(message, tone = "idle") {
  statusBox.textContent = message;
  statusBox.className = `status ${tone}`;
}

function setBusy(button, busy, busyText, idleText) {
  button.disabled = busy;
  button.textContent = busy ? busyText : idleText;
}

function getSharedSettings() {
  return {
    apiKey: document.querySelector("#api-key").value.trim(),
    region: document.querySelector("#region").value,
    targetModel: document.querySelector("#target-model").value.trim(),
  };
}

async function asJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.detail || payload.message || "请求失败。";
    throw new Error(detail);
  }
  return payload;
}

function setAudioUrl(url) {
  audioPlayer.src = url;
  audioPlayer.load();
  downloadLink.href = url;
  downloadLink.classList.remove("disabled");
}

cloneForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const sampleInput = document.querySelector("#sample");
  const consent = document.querySelector("#consent").checked;
  const preferredName = document.querySelector("#preferred-name").value.trim();
  const { apiKey, region, targetModel } = getSharedSettings();

  if (!sampleInput.files?.length) {
    setStatus("先选一段参考音频。", "error");
    return;
  }

  if (!targetModel) {
    setStatus("Model 不能为空。", "error");
    return;
  }

  const formData = new FormData();
  formData.append("sample", sampleInput.files[0]);
  formData.append("preferred_name", preferredName);
  formData.append("target_model", targetModel);
  formData.append("region", region);
  formData.append("consent", String(consent));
  if (apiKey) {
    formData.append("api_key", apiKey);
  }

  setBusy(cloneButton, true, "创建中...", "创建 Voice Token");
  setStatus("正在上传样音并创建 voice token...", "loading");

  try {
    const payload = await asJson(await fetch("/api/clone-voice", {
      method: "POST",
      body: formData,
    }));

    voiceTokenInput.value = payload.voice;
    lastVoiceInput.value = payload.voice;
    requestIdInput.value = payload.request_id || "";
    setStatus(`声音克隆成功，voice token 已生成：${payload.voice}`, "success");
  } catch (error) {
    setStatus(error.message || "创建 voice token 失败。", "error");
  } finally {
    setBusy(cloneButton, false, "创建中...", "创建 Voice Token");
  }
});

synthForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = document.querySelector("#text-input").value.trim();
  const voice = voiceTokenInput.value.trim();
  const languageType = document.querySelector("#language-type").value;
  const { apiKey, region, targetModel } = getSharedSettings();

  if (!voice) {
    setStatus("先生成 voice token，或者手动填一个已有的 token。", "error");
    return;
  }

  if (!text) {
    setStatus("请输入要生成的文本。", "error");
    return;
  }

  setBusy(synthButton, true, "生成中...", "生成音频");
  setStatus("正在调用 Qwen3-TTS 合成音频...", "loading");

  try {
    const payload = await asJson(await fetch("/api/synthesize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey || null,
        region,
        model: targetModel,
        voice,
        text,
        language_type: languageType,
      }),
    }));

    requestIdInput.value = payload.request_id || "";
    lastVoiceInput.value = payload.voice || voice;
    setAudioUrl(payload.audio_url);
    setStatus("音频已生成。你可以直接试听，或者点链接打开原始音频。", "success");
  } catch (error) {
    setStatus(error.message || "生成音频失败。", "error");
  } finally {
    setBusy(synthButton, false, "生成中...", "生成音频");
  }
});
