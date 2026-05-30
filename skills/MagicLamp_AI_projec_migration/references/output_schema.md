# DEHYDRATED_CONTEXT.md Output Schema (Module 3)

The handoff document is engineered to maximize cloud prompt-cache hits and lock
cost. Follow these rules exactly.

## Cache-stability law (Zero-Variance Locking)

- The header + sections 1–6 are a **static block**: identical byte stream every
  run. Never inject timestamps, run IDs, or random ordering into them.
- All volatile metadata (generation time, absolute root path) lives ONLY in the
  trailing `VOLATILE_METADATA` block, after the `---` separator.
- Goal: the static prefix is judged a Static Block by the provider and cached in
  full; new-session deltas append after the cached block to hit the ~90% cache
  discount.

## Fixed section order

```
# DEHYDRATED_CONTEXT
SCHEMA_VERSION / GENERATOR / CONTRACT
[CRITICAL_CONFUSED_ZONE]   (only if arbitration deadlocked)
1. STACK
2. TRUTH_SOURCE_RANKING (Stereo-Clock)
3. ATOMIC_BREAKPOINTS
4. GIT_HIGHLIGHT_ZONE
5. SHADOW_IGNORANCE
6. TARGET_TOOL_INIT
---
VOLATILE_METADATA
[TERMINATE_SESSION]
```

## Content laws

- **Dynamic Token Budget**: `T_budget = f(DependencyTreeDepth) × C_info_density`.
  Practically: NO duplicate code blocks, no repeated breakpoints (engine de-dups).
- **Absolute anchoring + horizon truncation**: describe code as
  `src/services/pay.ts -> login() -> line 89`. Never copy source paragraphs.
  Third-party deps (`node_modules`, `venv`, ...) are truncated to symbolic
  placeholders like `[External_Dep] -> React -> useState`.
- **Log de-noise**: for console errors keep only
  `{error type, error message, first business-code stack line}`.
  Drop the rest of the stack trace.
- **Secrets laundering**: every secret-like / high-entropy token is replaced with
  `[REDACTED_SECRET_HASH_SHA256:<hash>]` before it can enter the document.

## Status normalization

| Raw | Normalized |
|-----|------------|
| Done / 已完成 / Merged / Closed | `[DONE]` |
| In Progress / 进行中 / Doing / WIP / `- [ ]` | `[ACTIVE_BREAKPOINT]` |
| MUST / REQUIRED / 严禁 / 必须 | `[IRON_LAW]` |
