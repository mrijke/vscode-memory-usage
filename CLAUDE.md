# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn compile        # compile TypeScript to out/
yarn watch          # compile in watch mode
yarn vsce package --no-dependencies  # build a .vsix for distribution
```

Use `yarn` — never `npm`.

## Architecture

Two source files:

- **`src/meminfo.ts`** — all system reads. Exports `getMemStats()` (reads `/proc/meminfo` on Linux, `vm_stat`/`sysctl` on macOS) and `getTopProcesses()` (iterates `/proc/[pid]/status` on Linux only). No VS Code dependency.
- **`src/extension.ts`** — all VS Code integration. Owns the status bar item, the sparkline history buffer, the refresh timer, and config. Calls into `meminfo.ts` on each tick.

### Data flow

`setInterval` → `update()` → `getMemStats()` + `getTopProcesses()` → `buildLabel()` + `buildTooltip()` → status bar item.

Config is read once at activation into a cached `cfg` object and only re-read when `onDidChangeConfiguration` fires.

## README

Keep `README.md` in sync with the implementation. Specifically: the features list, the status bar example, and the configuration table must reflect the current behaviour. Update the README in the same commit as any user-facing change.

### Release automation

Releases are driven by conventional commits (`feat:` → minor, `fix:`/`perf:` → patch). Pushing to `main` triggers the `release-please` workflow, which opens a version-bump PR. Merging that PR creates a GitHub Release and immediately runs the `publish` job (same workflow file) which packages and uploads the `.vsix` as a release asset.
