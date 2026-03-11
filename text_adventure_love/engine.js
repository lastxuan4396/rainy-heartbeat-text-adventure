const FALLBACK_SAVE_KEY = "rainy-heartbeat-v2-save";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeSeededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function defaultProfile() {
  return {
    settings: {
      bgmOn: true,
      sfxOn: true
    },
    unlockedEndings: [],
    newGamePlusUnlocked: false,
    readNodes: []
  };
}

export class GameEngine {
  constructor(content, options = {}) {
    this.content = content;
    this.storage = options.storage ?? window.localStorage;
    this.storageKey = options.storageKey ?? content?.meta?.saveKey ?? FALLBACK_SAVE_KEY;
    this.seedOverride = Number.isFinite(options.seedOverride) ? options.seedOverride : null;

    this.profile = defaultProfile();
    this.resumeRun = null;
    this.state = this._createMenuState();

    this.listeners = new Set();
    this._autoAccumulator = 0;
    this._rng = makeSeededRandom(1);

    this._load();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot() {
    const statDefs = this.content.stats ?? [];
    const endings = this.content.endings ?? {};
    const visualConfig = this.content.visuals ?? { backgrounds: {}, portraits: {} };
    const node = this.state.mode === "playing" ? this._getCurrentNode() : null;
    const options = node ? this._getVisibleOptions(node) : [];
    const endingData = this.state.endingKey ? endings[this.state.endingKey] : null;
    const activeVisual = node
      ? {
          background: this._resolveBackground(node.background),
          portrait: this._resolvePortrait(node.portrait)
        }
      : endingData
        ? {
            background: this._resolveBackground(endingData.background),
            portrait: this._resolvePortrait(endingData.portrait)
          }
        : { background: null, portrait: null };

    return {
      mode: this.state.mode,
      title: this.content?.meta?.title ?? "雨夜心跳 · 文字冒险",
      subtitle: this.content?.meta?.subtitle ?? "",
      statDefs,
      stats: deepClone(this.state.stats),
      history: [...this.state.history],
      backlog: [...this.state.backlog],
      nodeId: this.state.currentNode,
      node,
      options,
      selectedOption: this.state.selectedOption,
      currentNodeWasRead: this.state.currentNodeWasRead,
      activeEvent: this.state.activeEvent ? deepClone(this.state.activeEvent) : null,
      feedback: this.state.feedback,
      endingKey: this.state.endingKey,
      endingData: endingData ? deepClone(endingData) : null,
      activeVisual,
      autoMode: this.state.autoMode,
      menuNewGamePlus: this.state.menuNewGamePlus,
      newGamePlus: this.state.newGamePlus,
      canContinue: Boolean(this.resumeRun),
      virtualTimeMs: this.state.virtualTimeMs,
      profile: {
        settings: deepClone(this.profile.settings),
        newGamePlusUnlocked: this.profile.newGamePlusUnlocked,
        unlockedEndings: [...this.profile.unlockedEndings],
        readNodesCount: this.profile.readNodes.length
      },
      visuals: {
        backgrounds: deepClone(visualConfig.backgrounds ?? {}),
        portraits: deepClone(visualConfig.portraits ?? {})
      },
      gallery: Object.entries(endings).map(([key, ending]) => ({
        key,
        title: ending.title,
        unlocked: this.profile.unlockedEndings.includes(key)
      }))
    };
  }

  startNewGame(useNewGamePlus = this.state.menuNewGamePlus) {
    const enableNewGamePlus = Boolean(useNewGamePlus && this.profile.newGamePlusUnlocked);
    this.state = this._createRunState(enableNewGamePlus);
    this._rng = makeSeededRandom(this.state.seed);
    this._autoAccumulator = 0;

    const startNode = this.content?.meta?.startNode ?? "opening";
    this._enterNode(startNode);
    this.state.feedback = enableNewGamePlus
      ? "New Game+ 已启动：基础属性 +1，并开放额外剧情选项。"
      : "故事开始。";

    this._persistAndEmit();
  }

  continueGame() {
    if (!this.resumeRun) {
      return false;
    }
    this.state = this._hydrateRun(this.resumeRun);
    this._rng = makeSeededRandom(this.state.seed);
    for (let i = 0; i < this.state.seedStep; i += 1) {
      this._rng();
    }
    this._autoAccumulator = 0;
    this.state.feedback = "已读取自动存档。";
    this._persistAndEmit();
    return true;
  }

  returnToMenu() {
    if (this.state.mode === "playing" || this.state.mode === "ended") {
      this.resumeRun = this._serializeRun(this.state);
    }
    const menu = this._createMenuState();
    menu.menuNewGamePlus = this.profile.newGamePlusUnlocked;
    menu.feedback = "已返回主菜单。";
    this.state = menu;
    this._persistAndEmit();
  }

  clearAutoSave() {
    this.resumeRun = null;
    if (this.state.mode === "menu") {
      this.state.feedback = "自动存档已清除，图鉴和已读记录已保留。";
    }
    this._savePayload();
    this._emit();
  }

  toggleMenuNewGamePlus() {
    if (this.state.mode !== "menu" || !this.profile.newGamePlusUnlocked) {
      return;
    }
    this.state.menuNewGamePlus = !this.state.menuNewGamePlus;
    this.state.feedback = this.state.menuNewGamePlus
      ? "New Game+ 已勾选。"
      : "New Game+ 已取消。";
    this._emit();
  }

  toggleSetting(key) {
    if (!Object.prototype.hasOwnProperty.call(this.profile.settings, key)) {
      return;
    }
    this.profile.settings[key] = !this.profile.settings[key];
    this._savePayload();
    this._emit();
  }

  moveSelection(delta) {
    if (this.state.mode !== "playing") {
      return;
    }
    const node = this._getCurrentNode();
    if (!node) {
      return;
    }
    const options = this._getVisibleOptions(node);
    if (!options.length) {
      return;
    }
    const current = this.state.selectedOption;
    const next = (current + delta + options.length) % options.length;
    this.state.selectedOption = next;
    this._emit();
  }

  chooseSelected() {
    this.choose(this.state.selectedOption);
  }

  choose(index) {
    if (this.state.mode !== "playing") {
      return false;
    }
    const node = this._getCurrentNode();
    if (!node) {
      return false;
    }
    const options = this._getVisibleOptions(node);
    const option = options[index];
    if (!option) {
      return false;
    }

    this._applyEffects(option.effects);
    this.state.feedback = option.feedback || this._buildEffectsFeedback(option.effects);

    if (Number.isFinite(option.addReckless)) {
      this.state.flags.recklessCount += option.addReckless;
    }
    if (option.setFlags && typeof option.setFlags === "object") {
      for (const [flag, value] of Object.entries(option.setFlags)) {
        this.state.flags[flag] = value;
      }
    }

    this._pushHistory(option.text);
    this._pushBacklog({
      type: "choice",
      label: "你的选择",
      text: option.text
    });

    if (option.next === "ending_check") {
      this._resolveEnding();
    } else {
      this._enterNode(option.next);
    }

    this._persistAndEmit();
    return true;
  }

  setAutoMode(mode) {
    if (this.state.mode !== "playing") {
      return;
    }
    const nextMode = mode === this.state.autoMode ? "off" : mode;
    this.state.autoMode = nextMode;
    this.state.feedback = nextMode === "fast"
      ? "快进中：将自动选择推荐选项。"
      : nextMode === "skipRead"
        ? "跳过已读中：遇到未读剧情会自动停止。"
        : "自动模式已关闭。";
    this._persistAndEmit();
  }

  tick(ms) {
    const dt = Number.isFinite(ms) ? Math.max(0, ms) : 0;
    this.state.virtualTimeMs += dt;
    if (this.state.mode !== "playing" || this.state.autoMode === "off") {
      return;
    }

    this._autoAccumulator += dt;
    const cadence = this.state.autoMode === "fast" ? 320 : 260;
    while (this._autoAccumulator >= cadence) {
      this._autoAccumulator -= cadence;
      if (this.state.mode !== "playing") {
        break;
      }
      if (this.state.autoMode === "skipRead" && !this.state.currentNodeWasRead) {
        this.state.autoMode = "off";
        this.state.feedback = "到达未读剧情，已停止跳过。";
        this._persistAndEmit();
        return;
      }
      const node = this._getCurrentNode();
      const options = node ? this._getVisibleOptions(node) : [];
      if (!options.length) {
        this.state.autoMode = "off";
        this._persistAndEmit();
        return;
      }
      let index = options.findIndex((option) => option.recommended);
      if (index < 0) {
        index = clamp(this.state.selectedOption, 0, options.length - 1);
      }
      this.choose(index);
    }
  }

  getTextState() {
    const snapshot = this.getSnapshot();
    return {
      mode: snapshot.mode,
      coordinateSystem: "N/A (text adventure, no 2D coordinates)",
      currentNode: snapshot.nodeId,
      nodeTitle: snapshot.node?.title ?? null,
      selectedOption: snapshot.selectedOption,
      options: snapshot.options.map((option) => option.text),
      stats: snapshot.stats,
      autoMode: snapshot.autoMode,
      ending: snapshot.endingKey,
      newGamePlus: snapshot.newGamePlus,
      currentNodeWasRead: snapshot.currentNodeWasRead,
      history: snapshot.history.slice(-4),
      activeEvent: snapshot.activeEvent ? snapshot.activeEvent.id : null,
      activeVisual: snapshot.activeVisual,
      galleryUnlocked: snapshot.profile.unlockedEndings,
      virtualTimeMs: snapshot.virtualTimeMs
    };
  }

  _createMenuState() {
    return {
      mode: "menu",
      currentNode: this.content?.meta?.startNode ?? "opening",
      selectedOption: 0,
      currentNodeWasRead: false,
      stats: this._initialStats(0),
      history: [],
      backlog: [],
      activeEvent: null,
      feedback: "",
      endingKey: null,
      newGamePlus: false,
      menuNewGamePlus: false,
      autoMode: "off",
      flags: {
        recklessCount: 0,
        moonToken: false,
        duetMoment: false,
        finalChoice: null,
        actEventsTriggered: {}
      },
      seed: 1,
      seedStep: 0,
      virtualTimeMs: 0
    };
  }

  _createRunState(newGamePlus) {
    const base = this._createMenuState();
    return {
      ...base,
      mode: "playing",
      newGamePlus,
      menuNewGamePlus: newGamePlus,
      stats: this._initialStats(newGamePlus ? 1 : 0),
      seed: this._createSeed(),
      seedStep: 0
    };
  }

  _initialStats(baseValue) {
    const stats = {};
    for (const statDef of this.content.stats ?? []) {
      stats[statDef.key] = baseValue;
    }
    return stats;
  }

  _createSeed() {
    if (Number.isFinite(this.seedOverride)) {
      return Math.abs(Math.floor(this.seedOverride)) || 1;
    }
    const candidate = Date.now() % 2147483647;
    return candidate > 0 ? candidate : 1;
  }

  _nextRandom() {
    this.state.seedStep += 1;
    return this._rng();
  }

  _getCurrentNode() {
    return this.content.nodes?.[this.state.currentNode] ?? null;
  }

  _resolveBackground(key) {
    if (!key) {
      return null;
    }
    return this.content.visuals?.backgrounds?.[key] ?? null;
  }

  _resolvePortrait(key) {
    if (!key) {
      return null;
    }
    return this.content.visuals?.portraits?.[key] ?? null;
  }

  _getVisibleOptions(node) {
    return (node.options ?? []).filter((option) => {
      if (option.requiresNewGamePlus && !this.state.newGamePlus) {
        return false;
      }
      if (option.requiresFlag && !this.state.flags[option.requiresFlag]) {
        return false;
      }
      return true;
    });
  }

  _applyEffects(effects = {}) {
    for (const statDef of this.content.stats ?? []) {
      const delta = Number(effects[statDef.key] ?? 0);
      const current = Number(this.state.stats[statDef.key] ?? 0);
      const next = clamp(
        current + delta,
        Number(statDef.min ?? -10),
        Number(statDef.max ?? 10)
      );
      this.state.stats[statDef.key] = next;
    }
  }

  _buildEffectsFeedback(effects = {}) {
    const values = Object.values(effects).map((value) => Number(value));
    const positive = values.filter((value) => value > 0).length;
    const negative = values.filter((value) => value < 0).length;
    if (positive && !negative) {
      return "你们之间的气氛明显更近了一步。";
    }
    if (!positive && negative) {
      return "这一步有些冒险，关系出现了轻微波动。";
    }
    if (positive && negative) {
      return "你推进了关系，但也留下了一点不确定。";
    }
    return "剧情继续推进。";
  }

  _pushHistory(text) {
    this.state.history.push(text);
    this.state.history = this.state.history.slice(-5);
  }

  _pushBacklog(entry) {
    const record = {
      type: entry.type,
      label: entry.label,
      text: entry.text
    };
    this.state.backlog.push(record);
    this.state.backlog = this.state.backlog.slice(-140);
  }

  _enterNode(nodeId) {
    if (!this.content.nodes?.[nodeId]) {
      this.state.mode = "ended";
      this.state.endingKey = "missed";
      return;
    }

    this.state.currentNode = nodeId;
    this.state.selectedOption = 0;
    this.state.activeEvent = null;

    const alreadyRead = this.profile.readNodes.includes(nodeId);
    this.state.currentNodeWasRead = alreadyRead;
    if (!alreadyRead) {
      this.profile.readNodes.push(nodeId);
    }

    const node = this._getCurrentNode();
    this._pushBacklog({
      type: "scene",
      label: node.badge,
      text: `${node.title}\n${node.text}`
    });
    this._triggerRandomEvent(node);
  }

  _triggerRandomEvent(node) {
    if (!node?.act) {
      return;
    }
    if (this.state.flags.actEventsTriggered[node.act]) {
      return;
    }
    this.state.flags.actEventsTriggered[node.act] = true;
    const pool = this.content.randomEvents?.[node.act] ?? [];
    if (!pool.length) {
      return;
    }

    const index = Math.floor(this._nextRandom() * pool.length);
    const event = pool[index];
    this.state.activeEvent = event;
    this._applyEffects(event.effects ?? {});
    this._pushBacklog({
      type: "event",
      label: "随机事件",
      text: event.text
    });
    if (event.feedback) {
      this.state.feedback = event.feedback;
    }
  }

  _resolveEnding() {
    const stats = this.state.stats;
    const flags = this.state.flags;

    let endingKey = "missed";
    if (flags.recklessCount >= 2 && stats.sincerity <= 2 && stats.courage >= 5) {
      endingKey = "bad";
    } else if (
      this.state.newGamePlus &&
      flags.moonToken &&
      (flags.finalChoice === "duet" || flags.finalChoice === "confess") &&
      stats.warmth >= 4 &&
      stats.courage >= 4 &&
      stats.sincerity >= 4
    ) {
      endingKey = "true";
    } else if (stats.warmth >= 3 && stats.courage >= 4) {
      endingKey = "sweet";
    } else if (stats.sincerity >= 4 && stats.warmth >= 2) {
      endingKey = "friend";
    }

    this.state.mode = "ended";
    this.state.endingKey = endingKey;
    this.state.autoMode = "off";
    this.state.activeEvent = null;

    const ending = this.content.endings?.[endingKey];
    if (ending) {
      this._pushBacklog({
        type: "ending",
        label: "结局",
        text: `${ending.title}\n${ending.text}`
      });
      this.state.feedback = ending.unlockNote ?? "你已完成一个结局。";
    }

    if (!this.profile.unlockedEndings.includes(endingKey)) {
      this.profile.unlockedEndings.push(endingKey);
    }
    this.profile.newGamePlusUnlocked = true;
  }

  _serializeRun(run) {
    return deepClone(run);
  }

  _hydrateRun(rawRun) {
    const run = this._createRunState(Boolean(rawRun?.newGamePlus));
    run.mode = rawRun?.mode === "ended" ? "ended" : "playing";

    if (typeof rawRun?.currentNode === "string" && this.content.nodes[rawRun.currentNode]) {
      run.currentNode = rawRun.currentNode;
    }
    run.selectedOption = Number.isFinite(rawRun?.selectedOption) ? rawRun.selectedOption : 0;
    run.currentNodeWasRead = Boolean(rawRun?.currentNodeWasRead);
    run.history = Array.isArray(rawRun?.history) ? rawRun.history.slice(-5) : [];
    run.backlog = Array.isArray(rawRun?.backlog) ? rawRun.backlog.slice(-140) : [];
    run.activeEvent = rawRun?.activeEvent ?? null;
    run.feedback = typeof rawRun?.feedback === "string" ? rawRun.feedback : "";
    run.endingKey = typeof rawRun?.endingKey === "string" ? rawRun.endingKey : null;
    run.autoMode = ["off", "fast", "skipRead"].includes(rawRun?.autoMode) ? rawRun.autoMode : "off";
    run.newGamePlus = Boolean(rawRun?.newGamePlus);
    run.menuNewGamePlus = run.newGamePlus;
    run.virtualTimeMs = Number.isFinite(rawRun?.virtualTimeMs) ? rawRun.virtualTimeMs : 0;
    run.seed = Number.isFinite(rawRun?.seed) ? rawRun.seed : run.seed;
    run.seedStep = Number.isFinite(rawRun?.seedStep) ? rawRun.seedStep : 0;

    if (rawRun?.flags && typeof rawRun.flags === "object") {
      run.flags = {
        ...run.flags,
        ...rawRun.flags,
        actEventsTriggered: {
          ...run.flags.actEventsTriggered,
          ...(rawRun.flags.actEventsTriggered ?? {})
        }
      };
    }

    for (const statDef of this.content.stats ?? []) {
      const loaded = Number(rawRun?.stats?.[statDef.key]);
      const initial = Number(run.stats[statDef.key] ?? 0);
      run.stats[statDef.key] = Number.isFinite(loaded)
        ? clamp(loaded, Number(statDef.min ?? -10), Number(statDef.max ?? 10))
        : initial;
    }

    return run;
  }

  _mergeProfile(input) {
    const merged = defaultProfile();
    if (input && typeof input === "object") {
      merged.newGamePlusUnlocked = Boolean(input.newGamePlusUnlocked);
      if (Array.isArray(input.unlockedEndings)) {
        merged.unlockedEndings = [...new Set(input.unlockedEndings)];
      }
      if (Array.isArray(input.readNodes)) {
        merged.readNodes = [...new Set(input.readNodes)];
      }
      if (input.settings && typeof input.settings === "object") {
        merged.settings.bgmOn = input.settings.bgmOn !== false;
        merged.settings.sfxOn = input.settings.sfxOn !== false;
      }
    }
    return merged;
  }

  _load() {
    let payload = null;
    try {
      const raw = this.storage.getItem(this.storageKey);
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }

    if (payload && typeof payload === "object") {
      this.profile = this._mergeProfile(payload.profile);
      if (payload.resumeRun && typeof payload.resumeRun === "object") {
        this.resumeRun = this._hydrateRun(payload.resumeRun);
      }
    }

    const menuState = this._createMenuState();
    menuState.menuNewGamePlus = this.profile.newGamePlusUnlocked;
    this.state = menuState;
    this._emit();
  }

  _savePayload() {
    const payload = {
      version: 2,
      profile: this.profile,
      resumeRun: this.resumeRun
    };
    this.storage.setItem(this.storageKey, JSON.stringify(payload));
  }

  _persistAndEmit() {
    if (this.state.mode === "playing" || this.state.mode === "ended") {
      this.resumeRun = this._serializeRun(this.state);
    }
    this._savePayload();
    this._emit();
  }

  _emit() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
