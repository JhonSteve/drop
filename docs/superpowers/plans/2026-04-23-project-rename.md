# Project Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the project identity from `openclaw-drop` to `drop` across local paths, tracked project context, desktop launcher verification, and the GitHub repository.

**Architecture:** This is a naming migration with no application behavior change. Repository files are updated first and committed, then the local directory is renamed, then GitHub is renamed via `gh`, and final verification runs from the new path.

**Tech Stack:** TypeScript, React, Vite, Express, Socket.IO, shell scripts, Git, GitHub CLI.

---

## File Structure

- Modify `start.sh`: update the hardcoded project directory.
- Modify `AGENTS.md`: restore and update project context under `[drop]`.
- Modify `docs/superpowers/specs/2026-04-23-drop-project-design.md`: record that the local path and GitHub repository have moved to `drop`.
- Create `docs/superpowers/plans/2026-04-23-project-rename.md`: this plan.
- Check `/Users/jhonsteve/Desktop/Drop.command`: verify it invokes `drop` and does not reference the old path.
- Rename local directory `/Users/jhonsteve/Downloads/openclaw-drop` to `/Users/jhonsteve/Downloads/drop`.
- Rename GitHub repository `JhonSteve/openclaw-drop` to `JhonSteve/drop` with `gh repo rename`.

### Task 1: Verify Current Rename Surface

**Files:**
- Read: `start.sh`
- Read: `AGENTS.md`
- Read: `docs/superpowers/specs/2026-04-23-drop-project-design.md`
- Read: `/Users/jhonsteve/Desktop/Drop.command`

- [ ] **Step 1: Run the pre-change old-name search**

Run:

```bash
rtk rg -n "openclaw-drop|/Users/jhonsteve/Downloads/openclaw-drop" -g '!node_modules/**' -g '!dist/**' -g '!logs/**' -g '!package-lock.json' .
```

Expected: matches in `start.sh`, `AGENTS.md`, docs, and the rename spec/plan only.

- [ ] **Step 2: Check the desktop launcher**

Run:

```bash
rtk sed -n '1,120p' /Users/jhonsteve/Desktop/Drop.command
```

Expected content:

```bash
#!/bin/bash
set -euo pipefail

LAUNCHER="$HOME/.local/share/desktop-tui/bin/desktop-tui"

if [[ ! -x "$LAUNCHER" ]]; then
  echo "找不到 TUI 启动器：$LAUNCHER"
  read -r -p "按回车关闭..." _
  exit 1
fi

exec env DESKTOP_TUI_AUTOCLOSE=1 "$LAUNCHER" drop "$@"
```

- [ ] **Step 3: Confirm GitHub CLI can operate**

Run:

```bash
rtk gh auth status
```

Expected: logged into `github.com` as `JhonSteve` with `repo` scope.

### Task 2: Update Tracked Project Context

**Files:**
- Modify: `start.sh`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-04-23-drop-project-design.md`

- [ ] **Step 1: Update `start.sh` project path**

Change:

```bash
PROJECT_DIR="/Users/jhonsteve/Downloads/openclaw-drop"
```

To:

```bash
PROJECT_DIR="/Users/jhonsteve/Downloads/drop"
```

- [ ] **Step 2: Replace `AGENTS.md` with the updated context**

Use this exact content:

```md
<claude-mem-context>
# Memory Context

# [drop] recent context, 2026-04-23 9:43pm GMT+8

## Local command convention

Shell commands in this workspace should follow the local RTK instruction at `/Users/jhonsteve/.codex/RTK.md`: prefix normal shell commands with `rtk` where supported.

## Project understanding

Drop is a React + TypeScript + Vite application with an Express + Socket.IO server. Its purpose is cross-device text, clipboard, file, and folder transfer for personal or small trusted-device use. The server maintains rooms and relays encrypted payloads; browsers perform encryption, decryption, file chunking, file assembly, and local message history.

The local project directory is `/Users/jhonsteve/Downloads/drop`, and the GitHub repository is `JhonSteve/drop`.

Key files:

- `server.ts`: HTTP/HTTPS server, Socket.IO rooms, 4-digit room codes, join approval, rate limiting, encrypted message relay, Vite middleware in development, static file serving in production.
- `src/App.tsx`: main UI and application state; currently owns room initialization, socket lifecycle, text/file flows, folder zipping, message history, mobile layout, desktop layout, and room-code approval UI.
- `src/lib/crypto.ts`: Web Crypto helpers for PBKDF2-derived AES-GCM keys, encrypted envelopes, room key generation, and room id derivation.
- `src/lib/file-worker.ts`: Web Worker for file encryption and 5MB chunk generation.
- `docs/superpowers/specs/2026-04-23-drop-project-design.md`: current project understanding and development blueprint.
- `docs/superpowers/specs/2026-04-23-project-rename-design.md`: design record for the `openclaw-drop` to `drop` rename.

## Important current judgment

The README says URL hash keys are not sent to the server and the server cannot decrypt content. Current room-code join behavior conflicts with that for normal non-password rooms: the client sends `window.location.hash.slice(1)` as `shareHash`, and `server.ts` stores/forwards it for approved room-code joins. For non-password rooms, this hash is enough to derive the AES-GCM key. Future security work should either redesign room-code joining so the server never receives decryptable key material, or update README/UI copy to describe the weaker reality.

## Suggested development priorities

1. Align security claims with implementation, especially around 4-digit room-code joining.
2. Split the oversized `src/App.tsx` into hooks and focused components before adding substantial features.
3. Improve large-file transfer reliability with chunk acknowledgement, retry, timeout cleanup, and receive progress.
4. Make password rooms a first-class UI flow instead of relying on `prompt`.
5. Consolidate production scripts and PID/log handling.
</claude-mem-context>
```

- [ ] **Step 3: Update the project blueprint with rename context**

Add this bullet under the project goals in `docs/superpowers/specs/2026-04-23-drop-project-design.md`:

```md
- 命名收敛：项目目录和 GitHub 仓库已从 `openclaw-drop` 迁移为 `drop`；历史迁移记录保留在 rename spec 中。
```

Add this bullet to the directory/module responsibility list:

```md
- `docs/superpowers/specs/2026-04-23-project-rename-design.md`：记录 `openclaw-drop` 到 `drop` 的命名迁移边界、GitHub 远端迁移和验证方式。
```

### Task 3: Verify Local File Edits

**Files:**
- Verify: `start.sh`
- Verify: `AGENTS.md`
- Verify: `docs/superpowers/specs/2026-04-23-drop-project-design.md`

- [ ] **Step 1: Search for old runtime references**

Run:

```bash
rtk rg -n "openclaw-drop|/Users/jhonsteve/Downloads/openclaw-drop" -g '!node_modules/**' -g '!dist/**' -g '!logs/**' -g '!package-lock.json' .
```

Expected: matches only in migration documents: `docs/superpowers/specs/2026-04-23-project-rename-design.md` and `docs/superpowers/plans/2026-04-23-project-rename.md`.

- [ ] **Step 2: Run whitespace verification**

Run:

```bash
rtk git diff --check -- start.sh AGENTS.md docs/superpowers/specs/2026-04-23-drop-project-design.md docs/superpowers/plans/2026-04-23-project-rename.md
```

Expected: no output and exit 0.

- [ ] **Step 3: Commit tracked file edits**

Run:

```bash
rtk git add start.sh AGENTS.md docs/superpowers/specs/2026-04-23-drop-project-design.md docs/superpowers/plans/2026-04-23-project-rename.md
rtk git commit -m "chore: rename project context to drop"
```

Expected: commit succeeds and includes only these tracked files.

### Task 4: Rename Local Directory

**Files:**
- Move directory: `/Users/jhonsteve/Downloads/openclaw-drop` -> `/Users/jhonsteve/Downloads/drop`

- [ ] **Step 1: Ensure target path is free**

Run:

```bash
rtk test ! -e /Users/jhonsteve/Downloads/drop
```

Expected: exit 0. If it exits non-zero, stop and inspect `/Users/jhonsteve/Downloads/drop`.

- [ ] **Step 2: Rename the directory**

Run from any stable parent directory:

```bash
rtk mv /Users/jhonsteve/Downloads/openclaw-drop /Users/jhonsteve/Downloads/drop
```

Expected: `/Users/jhonsteve/Downloads/drop` exists and contains the git repository.

- [ ] **Step 3: Verify git still works from the new path**

Run:

```bash
rtk git status --short
```

Working directory: `/Users/jhonsteve/Downloads/drop`

Expected: clean working tree.

### Task 5: Rename GitHub Repository and Remote

**Files:**
- Modify git remote config through `git remote set-url`
- Remote repository rename through GitHub CLI

- [ ] **Step 1: Confirm current remote**

Run:

```bash
rtk git remote -v
```

Expected: `origin` points to `https://github.com/JhonSteve/openclaw-drop.git`.

- [ ] **Step 2: Rename the GitHub repository**

Run:

```bash
rtk gh repo rename -R JhonSteve/openclaw-drop drop --yes
```

Expected: command exits 0. If GitHub reports `JhonSteve/drop` already exists, stop and report the conflict.

- [ ] **Step 3: Update local remote URL**

Run:

```bash
rtk git remote set-url origin https://github.com/JhonSteve/drop.git
```

Expected: command exits 0.

- [ ] **Step 4: Verify remote repository**

Run:

```bash
rtk gh repo view JhonSteve/drop --json nameWithOwner,url
rtk git remote -v
```

Expected: GitHub reports `JhonSteve/drop`, and local `origin` points to `https://github.com/JhonSteve/drop.git`.

### Task 6: Build and Final Verification

**Files:**
- Verify whole repository
- Verify `/Users/jhonsteve/Desktop/Drop.command`

- [ ] **Step 1: Run TypeScript verification**

Run:

```bash
rtk npm run lint
```

Working directory: `/Users/jhonsteve/Downloads/drop`

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 2: Run production build**

Run:

```bash
rtk npm run build
```

Working directory: `/Users/jhonsteve/Downloads/drop`

Expected: Vite build exits 0.

- [ ] **Step 3: Verify desktop launcher remains aligned**

Run:

```bash
rtk rg -n "openclaw-drop|/Users/jhonsteve/Downloads/openclaw-drop" /Users/jhonsteve/Desktop/Drop.command
rtk sed -n '1,120p' /Users/jhonsteve/Desktop/Drop.command
```

Expected: `rg` exits 1 with no matches; the script still executes `desktop-tui drop "$@"`.

- [ ] **Step 4: Verify old name only remains in migration records**

Run:

```bash
rtk rg -n "openclaw-drop|/Users/jhonsteve/Downloads/openclaw-drop" -g '!node_modules/**' -g '!dist/**' -g '!logs/**' -g '!package-lock.json' .
```

Working directory: `/Users/jhonsteve/Downloads/drop`

Expected: matches only in `docs/superpowers/specs/2026-04-23-project-rename-design.md` and `docs/superpowers/plans/2026-04-23-project-rename.md`.

- [ ] **Step 5: Commit any post-build tracked changes if necessary**

Run:

```bash
rtk git status --short
```

Expected: clean working tree. If `dist` or other tracked files changed because of the build, inspect them and commit only if they are expected tracked build artifacts.
