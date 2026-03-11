# Rainy Heartbeat

Rainy Heartbeat is a romance-style branching text adventure built with plain HTML, CSS, and JavaScript modules.

![Rainy Heartbeat preview](../docs/screenshots/rainy-heartbeat-home.png)

## Features

- Branching story flow driven by `story.json`
- Save and resume support through local storage
- Ending gallery and New Game+ unlock flow
- Keyboard shortcuts for selection, confirm, fast-forward, and backlog
- Lightweight audio direction for BGM and interaction feedback

## Key Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell and UI containers |
| `ui.js` | Rendering, controls, audio, DOM events |
| `engine.js` | Game state, branching logic, persistence |
| `story.json` | Nodes, choices, endings, visuals |
| `tests/` | Example action sequences for story-path checking |

## Local Preview

Run a static server from the repository root:

```powershell
cd E:\Windows\Codex
python -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/text_adventure_love/index.html
```

## Assets

- Backgrounds live in `assets/backgrounds/`
- Portraits live in `assets/portraits/`
- Attribution notes live in `assets/ATTRIBUTION.md`

## Deploy

The root [`render.yaml`](../render.yaml) is currently configured to publish this project as a static site.
