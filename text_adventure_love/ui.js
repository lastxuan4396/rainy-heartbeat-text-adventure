import { GameEngine } from "./engine.js";

const storyRoot = document.getElementById("story-root");
const statsRoot = document.getElementById("stats-root");
const historyBox = document.getElementById("history-box");
const galleryRoot = document.getElementById("gallery-root");
const backlogDialog = document.getElementById("backlog-dialog");
const backlogList = document.getElementById("backlog-list");
const closeBacklogBtn = document.getElementById("close-backlog-btn");
const backlogBtn = document.getElementById("backlog-btn");
const fastBtn = document.getElementById("fast-btn");
const skipBtn = document.getElementById("skip-btn");
const bgmToggle = document.getElementById("bgm-toggle");
const sfxToggle = document.getElementById("sfx-toggle");

let engine = null;
let snapshot = null;
let manualTimeControl = false;

class AudioDirector {
  constructor() {
    this.context = null;
    this.bgmIntervalId = null;
    this.bgmPointer = 0;
    this.bgmOn = true;
    this.sfxOn = true;
    this.progression = [220, 277, 330, 294];
  }

  ensureContext() {
    if (!this.context) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        return;
      }
      this.context = new Ctx();
    }
    if (this.context.state === "suspended") {
      this.context.resume();
    }
  }

  applySettings(settings, mode) {
    this.bgmOn = Boolean(settings?.bgmOn);
    this.sfxOn = Boolean(settings?.sfxOn);
    if (this.bgmOn && mode !== "ended") {
      this.startBgm();
    } else {
      this.stopBgm();
    }
  }

  startBgm() {
    if (this.bgmIntervalId) {
      return;
    }
    this.ensureContext();
    if (!this.context) {
      return;
    }
    this.bgmIntervalId = window.setInterval(() => {
      this.playBgmNote();
    }, 1200);
  }

  stopBgm() {
    if (this.bgmIntervalId) {
      window.clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
  }

  playBgmNote() {
    if (!this.bgmOn || !this.context) {
      return;
    }
    const frequency = this.progression[this.bgmPointer % this.progression.length];
    this.bgmPointer += 1;
    this.playTone(frequency, 0.25, 0.04, "triangle");
  }

  playSfx(kind) {
    if (!this.sfxOn) {
      return;
    }
    this.ensureContext();
    if (!this.context) {
      return;
    }
    const frequency = kind === "confirm" ? 620 : kind === "toggle" ? 460 : 340;
    const duration = kind === "confirm" ? 0.08 : 0.05;
    this.playTone(frequency, duration, 0.06, "sine");
  }

  playTone(frequency, durationSec, gainValue, type) {
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainValue, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + durationSec + 0.01);
  }
}

const audio = new AudioDirector();

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toAssetUrl(path) {
  if (!path) {
    return null;
  }
  try {
    return new URL(path, import.meta.url).href;
  } catch {
    return path;
  }
}

function renderVisualBlock(view, altSuffix) {
  const bgUrl = toAssetUrl(view.activeVisual?.background);
  const portraitUrl = toAssetUrl(view.activeVisual?.portrait);
  if (!bgUrl && !portraitUrl) {
    return "";
  }
  const portraitHtml = portraitUrl
    ? `<img class="portrait-img" src="${escapeHtml(portraitUrl)}" alt="角色立绘 ${escapeHtml(altSuffix)}">`
    : "";
  return `
    <div class="scene-visual">
      ${bgUrl ? `<img class="bg-img" src="${escapeHtml(bgUrl)}" alt="场景 ${escapeHtml(altSuffix)}">` : ""}
      <div class="visual-overlay"></div>
      ${portraitHtml}
    </div>
  `;
}

function parseSeedFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("seed")) {
    return null;
  }
  const seed = Number(params.get("seed"));
  return Number.isFinite(seed) ? seed : null;
}

async function loadStory() {
  const url = new URL("./story.json", import.meta.url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`加载 story.json 失败: ${response.status}`);
  }
  return response.json();
}

function updateStaticControls(view) {
  fastBtn.classList.toggle("active", view.autoMode === "fast");
  fastBtn.textContent = view.autoMode === "fast" ? "快进：开" : "快进：关";

  skipBtn.classList.toggle("active", view.autoMode === "skipRead");
  skipBtn.textContent = view.autoMode === "skipRead" ? "跳过已读：开" : "跳过已读：关";

  bgmToggle.classList.toggle("active", view.profile.settings.bgmOn);
  bgmToggle.textContent = `BGM：${view.profile.settings.bgmOn ? "开" : "关"}`;

  sfxToggle.classList.toggle("active", view.profile.settings.sfxOn);
  sfxToggle.textContent = `音效：${view.profile.settings.sfxOn ? "开" : "关"}`;
}

function renderStats(view) {
  const html = view.statDefs.map((statDef) => {
    const value = Number(view.stats[statDef.key] ?? 0);
    const min = Number(statDef.min ?? -2);
    const max = Number(statDef.max ?? 10);
    const percent = ((value - min) / (max - min)) * 100;
    return `
      <div class="stat">
        <div class="stat-row"><span>${escapeHtml(statDef.label)}</span><span>${value}</span></div>
        <div class="bar"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, percent))}%"></div></div>
      </div>
    `;
  }).join("");
  statsRoot.innerHTML = html;
}

function renderHistory(view) {
  historyBox.textContent = view.history.length
    ? view.history.join(" | ")
    : "你还没有做出选择。";
}

function renderGallery(view) {
  galleryRoot.innerHTML = view.gallery.map((entry) => {
    if (!entry.unlocked) {
      return `
        <div class="gallery-item locked">
          <div class="tag">未解锁</div>
          <div>？？？</div>
        </div>
      `;
    }
    return `
      <div class="gallery-item">
        <div class="tag">已解锁</div>
        <div>${escapeHtml(entry.title)}</div>
      </div>
    `;
  }).join("");
}

function renderBacklog(view) {
  if (!view.backlog.length) {
    backlogList.innerHTML = `<p class="backlog-text">暂无记录。</p>`;
    return;
  }
  backlogList.innerHTML = view.backlog.map((item) => {
    return `
      <article class="backlog-item">
        <div class="backlog-type">${escapeHtml(item.label)}</div>
        <div class="backlog-text">${escapeHtml(item.text)}</div>
      </article>
    `;
  }).join("");
}

function feedbackClass(feedbackText) {
  if (!feedbackText) {
    return "";
  }
  if (feedbackText.includes("更近") || feedbackText.includes("解锁") || feedbackText.includes("安心")) {
    return "positive";
  }
  if (feedbackText.includes("波动") || feedbackText.includes("乱来") || feedbackText.includes("停止")) {
    return "warn";
  }
  return "";
}

function renderMenu(view) {
  const ngPlusInfo = view.profile.newGamePlusUnlocked
    ? `New Game+ 已解锁：额外选项与隐藏结局开放。\n当前状态：${view.menuNewGamePlus ? "已启用" : "未启用"}`
    : "完成任意结局后可解锁 New Game+ 与隐藏线路。";

  storyRoot.innerHTML = `
    <section class="scene-card">
      <span class="badge">开场</span>
      <h2 class="scene-title">你会怎么开始这段关系？</h2>
      <p class="scene-text">这是一个恋爱向文字冒险 v2。\n新增：自动存档、剧情回看、结局图鉴、随机事件、隐藏结局与多周目。</p>
      ${view.feedback ? `<div class="feedback ${feedbackClass(view.feedback)}">${escapeHtml(view.feedback)}</div>` : ""}
      <p class="menu-note">${escapeHtml(ngPlusInfo)}</p>
      <div class="menu-actions">
        <button id="start-btn" class="action-btn" type="button">开始新故事</button>
        ${view.canContinue ? `<button id="continue-btn" class="action-btn" type="button">继续自动存档</button>` : ""}
        ${view.profile.newGamePlusUnlocked ? `<button id="toggle-ngplus-btn" class="action-btn" type="button">切换 New Game+</button>` : ""}
        ${view.canContinue ? `<button id="clear-save-btn" class="action-btn" type="button">清除自动存档</button>` : ""}
      </div>
    </section>
  `;

  document.getElementById("start-btn").addEventListener("click", () => {
    audio.ensureContext();
    audio.playSfx("confirm");
    engine.startNewGame(view.menuNewGamePlus);
  });

  const continueBtn = document.getElementById("continue-btn");
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      audio.ensureContext();
      audio.playSfx("confirm");
      engine.continueGame();
    });
  }

  const toggleNgPlusBtn = document.getElementById("toggle-ngplus-btn");
  if (toggleNgPlusBtn) {
    toggleNgPlusBtn.addEventListener("click", () => {
      audio.ensureContext();
      audio.playSfx("toggle");
      engine.toggleMenuNewGamePlus();
    });
  }

  const clearSaveBtn = document.getElementById("clear-save-btn");
  if (clearSaveBtn) {
    clearSaveBtn.addEventListener("click", () => {
      audio.ensureContext();
      audio.playSfx("toggle");
      engine.clearAutoSave();
    });
  }
}

function renderPlaying(view) {
  const optionHtml = view.options.map((option, index) => {
    const selected = index === view.selectedOption ? "selected" : "";
    return `<button class="choice-btn ${selected}" data-choice="${index}" type="button">${escapeHtml(option.text)}</button>`;
  }).join("");

  const eventHtml = view.activeEvent
    ? `
      <div class="event-card">
        <p class="event-title">随机事件</p>
        <p class="event-text">${escapeHtml(view.activeEvent.text)}</p>
      </div>
    `
    : "";

  storyRoot.innerHTML = `
    <section class="scene-card">
      ${renderVisualBlock(view, view.node.title)}
      <span class="badge">${escapeHtml(view.node.badge)}</span>
      <h2 class="scene-title">${escapeHtml(view.node.title)}</h2>
      <p class="scene-text">${escapeHtml(view.node.text)}</p>
      ${eventHtml}
      ${view.feedback ? `<div class="feedback ${feedbackClass(view.feedback)}">${escapeHtml(view.feedback)}</div>` : ""}
      <div class="choices">${optionHtml}</div>
      <div class="ending-actions">
        <button id="menu-btn" class="mini-btn" type="button">返回主菜单</button>
      </div>
    </section>
  `;

  for (const button of storyRoot.querySelectorAll("[data-choice]")) {
    button.addEventListener("click", (event) => {
      const index = Number(event.currentTarget.getAttribute("data-choice"));
      audio.ensureContext();
      audio.playSfx("confirm");
      engine.choose(index);
    });
  }

  document.getElementById("menu-btn").addEventListener("click", () => {
    audio.ensureContext();
    audio.playSfx("toggle");
    engine.returnToMenu();
  });
}

function renderEnding(view) {
  storyRoot.innerHTML = `
    <section class="scene-card">
      ${renderVisualBlock(view, view.endingData.title)}
      <span class="badge">结局</span>
      <div class="ending-card">
        <h2 class="ending-title">${escapeHtml(view.endingData.title)}</h2>
        <p class="scene-text">${escapeHtml(view.endingData.text)}</p>
      </div>
      ${view.feedback ? `<div class="feedback ${feedbackClass(view.feedback)}">${escapeHtml(view.feedback)}</div>` : ""}
      <div class="ending-actions">
        <button id="restart-btn" class="action-btn" type="button">再玩一次</button>
        <button id="end-menu-btn" class="action-btn" type="button">回到主菜单</button>
      </div>
    </section>
  `;

  document.getElementById("restart-btn").addEventListener("click", () => {
    audio.ensureContext();
    audio.playSfx("confirm");
    engine.startNewGame(view.newGamePlus || view.menuNewGamePlus);
  });

  document.getElementById("end-menu-btn").addEventListener("click", () => {
    audio.ensureContext();
    audio.playSfx("toggle");
    engine.returnToMenu();
  });
}

function render(view) {
  snapshot = view;
  renderStats(view);
  renderHistory(view);
  renderGallery(view);
  renderBacklog(view);
  updateStaticControls(view);
  audio.applySettings(view.profile.settings, view.mode);

  if (view.mode === "menu") {
    renderMenu(view);
  } else if (view.mode === "playing") {
    renderPlaying(view);
  } else {
    renderEnding(view);
  }
}

function setupKeyboard() {
  window.addEventListener("keydown", (event) => {
    if (!snapshot) {
      return;
    }
    if (event.key === "F5") {
      return;
    }
    if (backlogDialog.open && event.key.toLowerCase() !== "b") {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      if (backlogDialog.open) {
        backlogDialog.close();
      } else {
        backlogDialog.showModal();
      }
      return;
    }
    if (key === "f") {
      event.preventDefault();
      audio.ensureContext();
      audio.playSfx("toggle");
      engine.setAutoMode("fast");
      return;
    }
    if (key === "s") {
      event.preventDefault();
      audio.ensureContext();
      audio.playSfx("toggle");
      engine.setAutoMode("skipRead");
      return;
    }
    if (key === "m") {
      event.preventDefault();
      audio.ensureContext();
      audio.playSfx("toggle");
      engine.toggleSetting("bgmOn");
      return;
    }
    if (key === "n") {
      event.preventDefault();
      audio.ensureContext();
      audio.playSfx("toggle");
      engine.toggleSetting("sfxOn");
      return;
    }

    if (snapshot.mode === "menu") {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        audio.ensureContext();
        audio.playSfx("confirm");
        if (snapshot.canContinue) {
          engine.continueGame();
        } else {
          engine.startNewGame(snapshot.menuNewGamePlus);
        }
      } else if (key === "g" && snapshot.profile.newGamePlusUnlocked) {
        event.preventDefault();
        engine.toggleMenuNewGamePlus();
      } else if (key === "c" && snapshot.canContinue) {
        event.preventDefault();
        engine.continueGame();
      }
      return;
    }

    if (snapshot.mode === "ended") {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        audio.ensureContext();
        audio.playSfx("confirm");
        engine.startNewGame(snapshot.newGamePlus || snapshot.menuNewGamePlus);
      } else if (event.key === "Escape") {
        event.preventDefault();
        engine.returnToMenu();
      }
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      engine.moveSelection(-1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      engine.moveSelection(1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      audio.ensureContext();
      audio.playSfx("confirm");
      engine.chooseSelected();
    } else if (event.key === "Escape") {
      event.preventDefault();
      engine.returnToMenu();
    }
  });
}

function setupStaticButtons() {
  backlogBtn.addEventListener("click", () => {
    if (backlogDialog.open) {
      backlogDialog.close();
    } else {
      backlogDialog.showModal();
    }
  });

  closeBacklogBtn.addEventListener("click", () => {
    backlogDialog.close();
  });

  fastBtn.addEventListener("click", () => {
    audio.ensureContext();
    audio.playSfx("toggle");
    engine.setAutoMode("fast");
  });

  skipBtn.addEventListener("click", () => {
    audio.ensureContext();
    audio.playSfx("toggle");
    engine.setAutoMode("skipRead");
  });

  bgmToggle.addEventListener("click", () => {
    audio.ensureContext();
    audio.playSfx("toggle");
    engine.toggleSetting("bgmOn");
  });

  sfxToggle.addEventListener("click", () => {
    audio.ensureContext();
    audio.playSfx("toggle");
    engine.toggleSetting("sfxOn");
  });
}

function setupTimeHooks() {
  let lastTime = performance.now();

  function frame(now) {
    if (!manualTimeControl) {
      const dt = now - lastTime;
      engine.tick(dt);
    }
    lastTime = now;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.advanceTime = (ms) => {
    manualTimeControl = true;
    engine.tick(ms);
    return Promise.resolve();
  };

  window.render_game_to_text = () => {
    return JSON.stringify(engine.getTextState(), null, 2);
  };
}

function renderLoadError(message) {
  storyRoot.innerHTML = `
    <section class="scene-card">
      <span class="badge">加载失败</span>
      <h2 class="scene-title">故事资源未能加载</h2>
      <p class="scene-text">${escapeHtml(message)}</p>
      <p class="scene-text">请使用本地 HTTP 服务或在线地址打开页面，确保 \`story.json\` 可访问。</p>
    </section>
  `;
}

async function boot() {
  try {
    const story = await loadStory();
    engine = new GameEngine(story, { seedOverride: parseSeedFromQuery() });
    engine.subscribe(render);
    setupStaticButtons();
    setupKeyboard();
    setupTimeHooks();
  } catch (error) {
    renderLoadError(error instanceof Error ? error.message : String(error));
  }
}

boot();
