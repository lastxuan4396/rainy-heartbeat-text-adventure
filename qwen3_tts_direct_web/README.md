# Qwen3-TTS Direct Web Demo

This is the fastest version of the Qwen3-TTS prototype in this repository: one HTML file with the UI, styles, and browser-side request flow in one place.

## Good Fit

Use this demo when you want to:

- validate the product flow quickly
- test a new API payload without spinning up a backend
- adjust layout, labels, and interaction copy in one file

Use `qwen3_tts_clone_web/` instead when you want a safer prototype with a backend proxy and less API-key exposure in the browser.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Entire single-file app |
| `open_page.cmd` | Convenience launcher for local use |

## Local Preview

You can open `index.html` directly in a browser, or serve the repo root and visit:

```text
http://127.0.0.1:4173/qwen3_tts_direct_web/index.html
```

## Safety Note

This version is best for local testing only.
If you plan to share the app or deploy it publicly, move to the FastAPI version so the API key does not live directly in the browser.
