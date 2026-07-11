@C:\Users\17567\.codex\RTK.md

# Project Agent Instructions

This project is a lightweight Electron + TypeScript + Vite desktop sticky notes app.

## Working Style

- Do not only patch the exact symptom when the surrounding UX or architecture clearly needs a small adjacent improvement.
- Keep changes scoped to the current product direction: lightweight sticky notes, local files, no cloud sync, no database, no Siyuan sync for now.
- Prefer the existing code patterns and component structure over inventing new abstractions.
- Do not use visual/mockup tooling for this project unless the user explicitly asks for it. The user prefers screenshots and direct implementation.

## Superpower Workflow

- For UI/feature behavior changes, briefly reason about the intended design before editing.
- For bugs, investigate the root cause before fixing. Avoid guesswork such as arbitrary delays unless evidence supports it.
- For behavior changes, write or update focused tests first when practical, then implement.
- Before saying work is fixed or complete, run fresh verification:

```powershell
rtk npm test
rtk npm run typecheck
rtk npm run build
```

If a full verification is skipped for a specific reason, say exactly what was and was not run.

## Git And Files

- The worktree may contain user or previous-agent changes. Do not revert unrelated changes.
- Use `apply_patch` for manual source edits.
- Do not use destructive git commands such as `git reset --hard` or `git checkout --` unless the user explicitly asks.

## Windows Command Rules

- This machine is Windows. Use PowerShell syntax by default.
- Prefer `pwsh` when invoking PowerShell explicitly.
- Prefix executable commands with `rtk`.
- Do not call PowerShell cmdlets directly through `rtk`; run them through `rtk pwsh -NoProfile -Command '...'`.
