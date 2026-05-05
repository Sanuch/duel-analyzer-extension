# Duel Analyzer Resources Workspace

This repository now contains an MVP scaffold of the Duel Analyzer browser extension runtime.

## Implemented now

1. TypeScript + Vite build setup.
2. Chromium manifest overlay source in manifests/manifest.chromium.json.
3. Base realtime pipeline in content script:
   - extractStep
   - recognise
   - applyEvents
   - render
4. MutationObserver attached only to the step container selector.
5. Overlay with HP, power counters and last 5 processed steps.
6. Battle snapshots persisted to storage.local.
7. ADR and temporary AJAX contract docs for stage 0.

## Development

```bash
npm install
npm run typecheck
npm run build
```

Build output is generated in dist/ and includes manifest.json copied from manifests/manifest.chromium.json.

## Notes

1. Current selectors/patterns are local placeholders and will be replaced by stage 2 resources client.
2. Firefox/Safari manifests and packaging are planned for stage 5.
