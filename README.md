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
https://raw.githubusercontent.com/YOUR_ORG/duel-analyzer-phrases/main/manifest.v2.json
```

## Panel

One card on an arena log: a header (step, the duel condition), a Hero / Oppt table and the last steps.
It is shown at the top of the central column of a live log and as a collapsible, draggable window of
a finished one, which can be replayed — the panel follows the step shown by the page (`#turn_num`).

| Row | Meaning |
| --- | --- |
| Зд | Health in % of max health; after step 60 damage is amplified, then `30% (28%)` shows the value without the amplification |
| Вл | Influences in the current block, e.g. `4/6`; `4/6(2)` — the 2nd one was a "кривое" (empty / mutual / turned against the caster) |
| Гл | Voices in the current block, e.g. `7/10(3)`: 3 of them worked; `7/10(5:2)` — and 2 extra voices; `–` when the gods cannot be heard |
| Пр | Spent prana |

`Hero[3]` / `Oppt[1]`: how many influences each god can use right now. The last steps show the health
change of the step in %, with the amplification-free value in brackets. 🪙 marks a "coin" step (the
`is_coin` rule of logs2: after the 3rd step two plain action lines, three when the heroes go together)
and the header counts them (`3×🪙`). 🟡 marks an empty step (nobody acted; the plain lines are filler
texts) and the header warns while one is shown.

The "upload the log to the server" button is hidden for now (`UPLOAD_ENABLED` in `src/ui/overlay.ts`); the upload code and the background handler stay, so it comes back by flipping the flag once a server exists.

Every counted influence and voice of the log gets a badge (`2/6`, `2/6 ✗`, `7/10 ✓`) so each number can
be traced to its lines.

Health of every step comes from the `var hp` script of a finished log; a live log has none, so the points
seen while watching are remembered per battle in `storage.local`.

**Phrases.** As before, no phrase dictionaries are bundled. The panel needs the published catalog
(`influence`, `voice`, `miracle`, `conditions`) and a new type, `emptyStep` — filler texts of empty steps,
extracted from the `EmptyStepRecogniser` of logs2. Without `emptyStep` there are no empty-step marks;
without `conditions` the duel condition is unknown and coins are not shown.

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
export VITE_PHRASES_MANIFEST_URL="https://raw.githubusercontent.com/YOUR_ORG/duel-analyzer-phrases/main/manifest.v2.json"
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

## Versioning System

The extension uses semantic versioning with automatic patch generation:

**Quick Start:**
```bash
npm run build          # Builds with auto-generated patch version
```

**For Major/Minor Updates:**
1. Edit `VERSION.json`:
   ```json
   {
     "major": 1,
     "minor": 1
   }
   ```
2. Run `npm run build`

**Check for Updates in Plugin:**
- Automatically integrated with GitHub releases
- Caching: 24 hours
- User notifications via content script messages

📚 Full documentation: [docs/VERSION_MANAGEMENT.md](./docs/VERSION_MANAGEMENT.md)

Quick start: [docs/VERSIONING_QUICKSTART.md](./docs/VERSIONING_QUICKSTART.md)

Implementation details: [docs/IMPLEMENTATION_SUMMARY.md](./docs/IMPLEMENTATION_SUMMARY.md)

**Files:**
- `VERSION.json` — Base version (major.minor)
- `scripts/version.js` — Version generation script
- `src/core/version.ts` — Auto-generated version constants
- `src/core/version-checker.ts` — Update checker with GitHub API integration
- `.github/workflows/release.yml` — Automatic release creation on VERSION.json changes

## Architecture Highlights

- ✅ **No dependency on logs2** — Extension shipped separately from server
- ✅ **Decoupled phrase loading** — Phrases published independently, extension auto-updates
- ✅ **Checksum validation** — Each downloaded phrase file is verified
- ✅ **Fallback support** — Empty local patterns allow development without remote server
- ✅ **TypeScript strict mode** — Full type safety across resource loader and recognizer
- ✅ **Versioning system** — Semantic versioning with automatic patch generation and update checking

## Related Projects

- [duel-analyzer-phrases](https://github.com/YOUR_ORG/duel-analyzer-phrases) — Phrase catalog (separate repo)
- logs2 — Development-only reference (not shipped with extension)

1. Current selectors are local placeholders; phrase patterns are now loaded from the external `phrases` manifest via `VITE_PHRASES_MANIFEST_URL`.
2. Safari packaging is out of scope for current requirements.
3. Duel start tracking must rely on AJAX responses (arena status flags and arena log fields), not on page-only DOM heuristics.
4. DOM observers are used as a rendering/update mechanism after fight activity is confirmed by AJAX signals.
