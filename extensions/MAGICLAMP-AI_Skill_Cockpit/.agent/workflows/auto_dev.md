---
description: Automated Development Workflow for MagicLamp Cockpit
---

# MagicLamp Auto-Dev Workflow

This workflow automates the end-to-end development of the Skill Cockpit.

## Phase 1: Infrastructure Fix & Build

1. **Fix Config**: Remove invalid `video: true` from `tsconfig.json`.
// turbo
2. **Build Core**: Run `npm run package` to ensure the build pipeline is green.

## Phase 2: Core Logic Implementation (Host Side)

3. **Core Services**: Create `src/core/services/`
    * `ManifestService.ts`: Implement `ManifestLoader` to fetch `discovery_manifest.json`.
    * `GitService.ts`: Implement `git fetch` checks.
    * `SecurityService.ts`: Implement `DeepScan` mock logic.

2. **State Manager**: Create `src/core/managers/SkillManager.ts`.
    * Implement `refresh()` to scan all 3 sources (Manifest, Git, Local).
    * Implement `install(url)` logic.

## Phase 3: UI Implementation (Webview Side)

5. **UI Scaffold**:
    * Create `src/webview/components/layout/NavRail.tsx`.
    * Create `src/webview/pages/Console.tsx` (Data Grid).
    * Create `src/webview/pages/Marketplace.tsx` (Card Grid).

2. **Wiring**:
    * Update `src/webview/index.tsx` to use the `NavRail` and route between pages.
    * Connect `Console` to `useMessenger` to display real data.

## Phase 4: Verification

// turbo
7.  **Final Build**: Run `npm run package` again.
8.  **Self-Test**: Run `npm test` (if tests exist) or verify file output sizes.
