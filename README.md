# Duel Analyzer Extension

Realtime browser extension for analyzing Godville duel battles.

## Architecture

The extension is composed of two independent projects:

### 1. **duel-analyzer-extension** (this repository)
Browser extension that analyzes battle text in real-time. At startup, it loads phrase patterns from a remote manifest to recognize battle events.

**Dependencies:** None on logs2. Uses only the published phrases catalog.

**Key Components:**
- Content script: Observes battle steps and pipes them through the recognizer
- Recognizer: Matches battle text against loaded phrase patterns  
- Overlay: Displays analyzed battle state (HP, power, history)
- Resource loader: Fetches and caches phrase data from remote manifest

### 2. **duel-analyzer-phrases** (separate repository)
Standalone phrase catalog published to GitHub. Contains battle pattern data extracted from logs2 recognizers.

**URL Template:**
```
https://raw.githubusercontent.com/YOUR_ORG/duel-analyzer-phrases/main/manifest.json
```

## Building the Extension

### Prerequisites
- Node.js 22+
- npm

### Development
```bash
npm install
npm run typecheck   # Check for type errors
npm run build       # Build dist/
npm run dev         # Watch mode
```

### Production Build
Set the phrases manifest URL before building:

```bash
export VITE_PHRASES_MANIFEST_URL="https://raw.githubusercontent.com/YOUR_ORG/duel-analyzer-phrases/main/manifest.json"
npm run build
```

Or configure it in `.env` or GitHub Actions repository variables.

Build output appears in `dist/` with `manifest.json` for Chromium-based browsers.

## GitHub Actions CI/CD

The workflow [.github/workflows/build-extension.yml](.github/workflows/build-extension.yml) builds the extension on every push to `main` for:
- `chromium` target (Chrome, Edge, Opera)
- `firefox` target

**Required Repository Variable:**
- `VITE_PHRASES_MANIFEST_URL` — URL to the phrases repository manifest (set in repository settings under Variables)

## Architecture Highlights

- ✅ **No dependency on logs2** — Extension shipped separately from server
- ✅ **Decoupled phrase loading** — Phrases published independently, extension auto-updates
- ✅ **Checksum validation** — Each downloaded phrase file is verified
- ✅ **Fallback support** — Empty local patterns allow development without remote server
- ✅ **TypeScript strict mode** — Full type safety across resource loader and recognizer

## Related Projects

- [duel-analyzer-phrases](https://github.com/YOUR_ORG/duel-analyzer-phrases) — Phrase catalog (separate repo)
- logs2 — Development-only reference (not shipped with extension)

1. Current selectors are local placeholders; phrase patterns are now loaded from the external `phrases` manifest via `VITE_PHRASES_MANIFEST_URL`.
2. Safari packaging is out of scope for current requirements.
3. Duel start tracking must rely on AJAX responses (arena status flags and arena log fields), not on page-only DOM heuristics.
4. DOM observers are used as a rendering/update mechanism after fight activity is confirmed by AJAX signals.
