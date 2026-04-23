# Project Rename Design

日期：2026-04-23

## 1. 目标

将项目标识从 `openclaw-drop` 收敛为 `drop`，包括本地目录、仓库内硬编码路径、agent 上下文、开发文档、桌面启动脚本验证，以及 GitHub 远端仓库名称。

本次迁移不改变产品显示名 `Drop`、npm 包名 `drop`、Cloudflare Tunnel 名 `drop`、公网域名 `https://drop.jhonsteve.com` 或应用运行逻辑。

## 2. 命名边界

需要迁移的旧标识：

- 本地目录：`/Users/jhonsteve/Downloads/openclaw-drop`
- GitHub 仓库：`JhonSteve/openclaw-drop`
- 文档和 agent 上下文中的项目上下文名：`openclaw-drop`
- 脚本中的硬编码项目路径：`/Users/jhonsteve/Downloads/openclaw-drop`

保留的既有标识：

- 产品名：`Drop`
- package name：`drop`
- Tunnel 名：`drop`
- PID 文件前缀：`drop`
- 域名：`drop.jhonsteve.com`
- 桌面脚本命令参数：`drop`

## 3. 文件和目录影响

仓库内预计修改：

- `start.sh`：将 `PROJECT_DIR="/Users/jhonsteve/Downloads/openclaw-drop"` 更新为 `PROJECT_DIR="/Users/jhonsteve/Downloads/drop"`。
- `AGENTS.md`：将 memory context header 和项目认知更新为 `[drop]`，并保留项目关键事实。
- `docs/superpowers/specs/2026-04-23-drop-project-design.md`：补充项目目录和 GitHub 仓库已迁移为 `drop` 的认知。
- `docs/superpowers/specs/2026-04-23-project-rename-design.md`：记录本设计。
- `docs/superpowers/plans/2026-04-23-project-rename.md`：记录实施计划。

仓库外预计检查：

- `/Users/jhonsteve/Desktop/Drop.command`：当前内容调用 `desktop-tui drop`，没有发现旧目录硬编码。实施时仍要读取并验证；只有发现旧标识时才修改。

本地目录预计迁移：

- 从 `/Users/jhonsteve/Downloads/openclaw-drop`
- 到 `/Users/jhonsteve/Downloads/drop`

## 4. GitHub 远端影响

当前远端：

```text
origin https://github.com/JhonSteve/openclaw-drop.git
```

目标远端：

```text
origin https://github.com/JhonSteve/drop.git
```

实施时通过 GitHub CLI 执行仓库 rename，并在成功后更新本地 `origin`：

```bash
gh repo rename drop --repo JhonSteve/openclaw-drop --yes
git remote set-url origin https://github.com/JhonSteve/drop.git
```

如果 GitHub 上 `JhonSteve/drop` 已存在，rename 会失败；此时停止远端迁移，保留本地文件修改，并报告冲突。

## 5. 测试和验证

迁移后在新目录 `/Users/jhonsteve/Downloads/drop` 执行：

```bash
rg "openclaw-drop" -g '!node_modules/**' -g '!dist/**' -g '!logs/**' -g '!package-lock.json' .
npm run lint
npm run build
git remote -v
gh repo view JhonSteve/drop --json nameWithOwner,url
```

预期：

- 旧名搜索没有命中需要迁移的运行时或文档引用。
- TypeScript `noEmit` 通过。
- Vite build 通过。
- 本地 `origin` 指向 `https://github.com/JhonSteve/drop.git`。
- GitHub CLI 能查看 `JhonSteve/drop`。

## 6. 风险与处理

- 目录重命名会让当前 shell 工作目录失效；实施时先完成仓库内修改和提交，再切换到父目录执行 `mv`，后续命令使用新路径。
- 桌面脚本在仓库外，不会被 git 跟踪；实施结果需要在最终报告中单独说明。
- GitHub 仓库 rename 是远端状态变更；执行前确认工作区已提交，执行后立即更新 remote URL。
- 如果远端 rename 失败，不继续强行推送到旧仓库名，先报告失败原因。
