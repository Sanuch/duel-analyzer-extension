# ADR-0001: MVP constraints and assumptions

Date: 2026-05-05
Status: Accepted

## Context

The Duel Analyzer browser extension must replicate server-side duel parsing in realtime on the battle page while keeping combat analytics local.

## Decision

1. Browser support policy: latest stable only for Chrome, Edge, Firefox, Opera, Safari.
2. Network policy:
   - No network requests for combat analytics.
   - Network requests are allowed only for phrase/resources download and unknown phrase reporting.
3. Temporary AJAX contract is defined in [docs/contracts/ajax-temp-contract.md](../contracts/ajax-temp-contract.md).
4. MVP architecture uses a deterministic local pipeline:
   - extractStep
   - recognise
   - applyEvents
   - render
5. Extension stores battle snapshots in storage.local for local history and debugging.

## Consequences

1. Analytics works offline once required resources are cached.
2. Resource schema versioning and checksum verification become mandatory in stage 2.
3. Real API integration for unknown phrase reporting remains behind a feature flag (stage 3).
