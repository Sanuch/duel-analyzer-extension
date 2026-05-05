# Temporary AJAX contract (pre-integration)

Date: 2026-05-05
Status: Draft for stage 4

## Goal

Describe a stable internal format for AJAX interception before real endpoints and response contracts are available.

## Rule source

The extension loads ajax_rules resource (stage 4) and matches runtime traffic by URL/method/status.

## Internal normalized event

```ts
interface AjaxEvent {
  id: string;
  ts: number;
  source: "fetch" | "xhr";
  method: string;
  url: string;
  status: number;
  matchedRuleId?: string;
  payloadType: "json" | "text" | "empty" | "unknown";
  summary: string;
  masked: Record<string, string>;
}
```

## Temporary matching fields

1. URL regex
2. HTTP method
3. Status range

## Security notes

1. Do not persist raw sensitive fields.
2. Use masking for token-like values and ids in logs and overlay summary.
