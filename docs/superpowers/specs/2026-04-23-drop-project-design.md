# Drop 项目理解与后续开发蓝图

日期：2026-04-23

## 1. 项目定位

Drop 是一个面向个人和小范围可信设备的跨设备文本、剪贴板和文件传输工具。它的核心价值不是长期存储或多人协作，而是让用户在手机、Mac、平板和其他浏览器设备之间快速建立一个临时传输通道。

项目当前强调三个产品目标：

- 快速连接：通过分享链接、二维码和 4 位房间号降低跨设备加入成本。
- 本地优先：浏览器端负责加密、解密、文件组装和历史展示，服务端只维持连接与转发。
- 轻量部署：一个 Node 进程同时承载 Socket.IO 服务和前端产物，生产环境可通过 Cloudflare Tunnel 暴露公网访问。

这个定位适合继续做成“私人即时传输工具”，不适合在当前架构上直接扩展成带账号、云盘、审计、团队权限的大型文件平台。

## 2. 当前产品能力

当前应用已经具备可用的端到端传输体验：

- 自动创建房间：首次访问没有 hash 时，前端生成 room key 并写入 URL fragment。
- 链接和二维码加入：其他设备通过完整 URL 获取房间 key 并加入同一房间。
- 4 位房间号加入：房间内设备持有 4 位数字码，外部设备发起加入请求，房间成员确认后服务端向请求设备返回分享 hash。
- 文本传输：支持手动输入、粘贴并发送、长文本折叠、Markdown 渲染和手动复制。
- 文件传输：支持多个文件、文件夹压缩成 zip、500MB 以内传输、大文件分片发送。
- 移动端优化：移动端保留快捷操作，键盘弹出时调整输入区域。
- 本地历史：消息元数据和文本保存到 localStorage，文件二进制不持久化。
- PWA 基础：manifest 和 service worker 已存在，但当前 service worker 只做 install/activate。

## 3. 技术栈与运行方式

主要技术栈：

- 前端：React 19、TypeScript、Vite 6、TailwindCSS v4、lucide-react、motion、qrcode.react、react-markdown。
- 后端：Express 4、Socket.IO 4、tsx、mkcert。
- 加密：Web Crypto API，PBKDF2 派生 AES-GCM 256-bit key。
- 文件处理：Web Worker 加密文件，JSZip 处理文件夹压缩。
- 部署：生产模式由 `server.ts` 提供静态文件和 Socket.IO；公网访问依赖 Cloudflare Tunnel。

常用命令：

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

本地开发运行 `npm run dev` 时，`server.ts` 会在非 production 环境生成本地 HTTPS 证书，并把 Vite 作为 middleware 挂载到同一个服务。生产脚本会设置 `NODE_ENV=production`，用 `npx tsx server.ts` 启动服务，并通过 cloudflared tunnel 暴露 `https://drop.jhonsteve.com`。

## 4. 目录与模块职责

当前目录职责如下：

- `server.ts`：服务入口，负责 HTTPS/HTTP 创建、Socket.IO 初始化、房间成员计数、4 位房间码、加入审批、密文消息转发、开发模式 Vite middleware、生产静态文件。
- `src/App.tsx`：主应用组件，集中承担房间初始化、Socket 生命周期、消息收发、文件发送、文件夹压缩、移动端适配、桌面和移动端 UI。
- `src/lib/crypto.ts`：前端加密基础设施，包含 key 派生、AES-GCM envelope 加解密、base64 转换、room key 和 room id 派生。
- `src/lib/file-worker.ts`：Web Worker，负责在后台线程加密文件，避免主线程在大文件处理时卡顿。
- `src/components/ErrorBoundary.tsx`：React 错误边界。
- `src/index.css`：Tailwind 引入、typography 插件、安全区域和移动端键盘相关 CSS。
- `public/manifest.json` 和 `public/sw.js`：PWA 壳层。
- `manage.sh`、`start.sh`、`Start.command`、`Stop.command`、`Drop.command`：本机和公网部署管理脚本。
- `.github`：issue 和 PR 模板。
- `AGENTS.md`：仓库级 agent 上下文入口。当前内容是 Claude memory context，用于让后续自动化或协作 agent 读取项目会话背景，不参与应用运行时。

最明显的结构问题是 `src/App.tsx` 已经超过 1300 行，并同时承载产品逻辑、协议逻辑、文件处理和视图布局。后续功能开发应逐步把它拆成更清晰的边界，而不是继续追加状态和事件处理。

## 5. 核心数据流

### 5.1 房间创建和加入

1. 浏览器打开应用。
2. 如果 URL 没有 hash，前端生成随机 room key，并写入 `window.location.hash`。
3. 前端从 room key 派生 AES-GCM key 和 server-side room id。
4. Socket 连接成功后，客户端发起 `join-room`。
5. 服务端记录 socket 所属 room，广播房间人数和房间码。

普通链接加入时，其他设备直接从 URL hash 获得 room key，因此能派生同一个加密 key 和 room id。

4 位房间号加入时，外部设备先请求 `request-join-by-code`。服务端找到对应 room 后，把加入请求广播给房间内设备。房间内任意成员批准后，服务端把保存的 `shareHash` 返回给请求设备，请求设备设置 hash 并 reload。

### 5.2 文本消息发送

1. 发送端调用 `encryptPayload`，把 `{ type: "text", text }` 加 nonce 和 timestamp 后 JSON 序列化。
2. Web Crypto 使用 AES-GCM 加密，产生 `{ iv, ciphertext }`。
3. 客户端通过 Socket.IO 发出 `send-message`。
4. 服务端校验 socket 已加入目标 room，仅转发 payload 给同 room 其他设备。
5. 接收端调用 `decryptPayload` 解密，校验 nonce、timestamp 和消息类型后渲染。

### 5.3 文件消息发送

小文件路径：

1. 主线程读取 File 为 ArrayBuffer。
2. ArrayBuffer transfer 到 Web Worker。
3. Worker base64 编码文件数据并整体加密为一个 envelope。
4. 发送端发出一个 `send-message`。
5. 接收端解密后还原 ArrayBuffer，并提供下载。

大文件路径：

1. Worker 按 5MB 切片。
2. 每片构造成包含 `fileId`、`chunkIndex`、`totalChunks`、文件名、类型、大小和 chunkData 的 payload。
3. 每个 chunk 单独加密并发送。
4. 接收端按 `fileId` 收集 chunk，收齐后按顺序重组文件。

## 6. 安全模型与现实边界

项目的理想安全模型是：服务端不接触明文，客户端通过 URL hash 获得加密材料，所有消息和文件元数据都在客户端加密后再发送。

当前已经做到的部分：

- 文本内容、文件内容、文件名、文件类型、文件大小等消息元数据被包含在 encrypted payload 内。
- Socket.IO 服务端不解析消息明文。
- 每条消息带随机 nonce 和 timestamp，接收端有基础重放防护。
- 下载文件名前会做路径穿越相关清洗。
- 服务端对消息发送和房间号加入做了简单限流。
- 4 位房间号加入需要房间内设备确认，降低了纯枚举风险。

必须明确的现实边界：

- 当前 4 位房间号加入流程会把 `window.location.hash.slice(1)` 作为 `shareHash` 发给服务端保存和转发。
- 对普通无密码房间来说，`shareHash` 就是可派生 AES key 的材料。服务端一旦获得该 hash，就具备解密该房间消息的能力。
- 对密码房间来说，hash 中包含 room key 和 `:pw` 标记，实际消息 key 还需要用户额外输入的密码，因此服务端只拿到 hash 不足以解密内容。
- README 当前“URL Hash 存储密钥，不会发送到服务器”“服务器无法解密”“零知识架构”等表述，与 4 位房间号功能下的无密码房间现实不完全一致。

因此，后续开发必须先在产品层做一个选择：

- 如果继续坚持零知识：服务端不能保存或转发可解密材料，4 位房间号加入需要重新设计。
- 如果保留当前房间号体验：README 和 UI 需要明确说明房间号确认加入会让服务端临时参与分享链接转发，无密码房间不应被称为严格零知识。

## 7. 当前设计优点

项目已有几个值得保留的设计：

- 单进程部署简单，适合个人工具和家庭局域网场景。
- 客户端加密 envelope 边界清晰，服务端消息转发逻辑相对干净。
- room id 由 key 派生，服务端不需要知道用户可读房间名。
- 文件加密放在 Web Worker，避免大文件加密完全阻塞 UI。
- 大文件分片发送降低单个 payload 的压力。
- 移动端和桌面端都不是简单缩水版，已经覆盖实际跨设备传输路径。
- 近期提交显示项目已在修正房间号枚举和隐私泄露问题，说明安全边界是维护重点。

## 8. 主要风险与技术债

### 8.1 安全文档与实现不一致

这是最高优先级问题。产品当前对外宣称严格零知识，但无密码房间的 4 位房间号确认加入会把解密材料交给服务端。后续任何安全相关功能都应先处理这个矛盾。

### 8.2 `App.tsx` 责任过重

主组件同时管理协议、状态、UI、文件处理和移动端布局。继续追加功能会增加回归概率。建议拆分为：

- `hooks/useRoomSession.ts`：room key、room id、password、Socket lifecycle。
- `hooks/useEncryptedMessages.ts`：消息加解密、nonce、timestamp、localStorage。
- `hooks/useFileTransfer.ts`：文件、文件夹、Worker、分片收集。
- `components/MessageBubble.tsx`：消息渲染。
- `components/RoomPanel.tsx`：二维码、房间号、加入审批。
- `components/Composer.tsx`：文本输入、粘贴发送、文件入口。
- `components/MobileLayout.tsx` 和 `components/DesktopLayout.tsx`：布局层。

### 8.3 服务端状态全部在内存

房间、房间码、room hash、pending request 和限流都存在内存中。进程重启会丢失状态。这符合临时传输工具定位，但需要在文档和 UI 上接受“房间是临时的”。

### 8.4 大文件传输可靠性有限

当前大文件 chunk 发送只是在客户端按 50ms 间隔发出，没有 ack、重试、断点续传、缺片超时、进度同步或背压控制。网络波动、移动端后台、Cloudflare Tunnel 抖动都可能导致文件传输失败或长时间悬挂。

### 8.5 本地历史与文件体验不一致

文本和文件元数据会持久化，但文件二进制不会保存。刷新后仍能看到文件消息，但不能下载历史文件。这是合理取舍，但 UI 应明确表达“文件仅本次会话可下载”。

### 8.6 密码房间 UX 不完整

创建密码房间目前使用 `prompt`，密码不在链接中，用户需要单独分享。这个安全性更好，但体验粗糙，也缺少密码错误的真实验证机制：AES key 派生本身不会失败，只有收到消息解密失败时才体现错误。

### 8.7 PWA 目前只是壳

service worker 没有缓存策略，也没有离线页或版本更新机制。它目前只能算 PWA 基础配置，不能作为离线能力承诺。

### 8.8 Agent 上下文需要保持可信

`AGENTS.md` 已作为项目上下文文件纳入跟踪，但当前只记录 memory context。后续如果把项目约定、命令规范或安全边界写入其中，需要避免和 README、spec 文档产生冲突。agent 上下文应描述稳定事实和工作约定，不应存放过期状态、临时结论或敏感信息。

## 9. 后续开发展望

推荐把 Drop 发展为“可信设备间的临时加密传输站”，重点做好以下方向：

### 9.1 安全模型收敛

优先决定安全承诺。推荐目标是恢复严格零知识：

- 服务端只保存 room id、房间人数、临时请求 id 和不可解密的握手材料。
- 4 位房间号只作为发现和请求通道，不直接让服务端保存解密材料。
- 加入审批可以改为由已在房间内的客户端通过已建立的加密通道或公钥封装，把 room key 安全发给请求端。

如果短期不重做协议，则应把 README、UI 和安全说明改为“端到端加密消息转发，房间号确认加入依赖服务端临时转发分享链接”。

### 9.2 文件传输协议增强

文件传输应从“发送若干加密 chunk”升级为有状态传输协议：

- 每个文件有 transfer id。
- 接收端对 chunk ack。
- 发送端维护发送窗口，避免一次性堆太多消息。
- 缺片可重发。
- 超时后清理 incomplete transfer。
- 发送端和接收端都显示真实进度。

这会显著提升大文件和移动网络场景的可靠性。

### 9.3 代码边界重构

在添加新功能前，先把 `App.tsx` 拆到 hooks 和小组件。重构应保持行为不变，先补基本测试或至少保留手动验证清单。

拆分目标不是追求抽象，而是让后续安全协议、文件传输和 UI 迭代能独立修改。

### 9.4 更清晰的会话模型

建议显式区分：

- 当前房间：基于 URL hash 和派生 room id。
- 当前设备：socket id 只是连接 id，不适合作长期设备身份。
- 当前传输：一次文本或文件发送。
- 本地历史：仅当前浏览器、当前 room id 下的展示记录。

这会让 UI 文案、状态管理和后续测试更稳定。

### 9.5 部署和运维稳固

当前脚本较实用，但存在多个入口和 PID 文件位置不完全统一的问题。后续可以收敛为：

- `manage.sh start|stop|restart|status|logs`
- 明确 server/tunnel PID 文件位置。
- 启动前检查 `dist`、Node 版本、cloudflared 配置和端口占用。
- 生产启动优先使用构建产物和 `node dist/server.js`，而不是生产环境仍依赖 `tsx server.ts`。

## 10. 建议的近期迭代顺序

### 第一阶段：对齐安全承诺

目标：消除 README、UI 与实现之间的安全矛盾。

建议任务：

1. 明确无密码房间号加入是否允许服务端接触 share hash。
2. 如果允许，更新 README 和 UI 安全说明。
3. 如果不允许，设计新的房间号加入握手协议。
4. 给房间号加入流程补测试或至少补可复现手动验证清单。

### 第二阶段：拆分 `App.tsx`

目标：降低后续修改风险。

建议任务：

1. 先抽 `MessageBubble`、`AutoCopyToggle`、房间卡片和输入区组件。
2. 再抽 room/session hook。
3. 再抽 encrypted message hook。
4. 最后抽 file transfer hook。

每一步都应保持功能行为不变，并运行 `npm run lint`。

### 第三阶段：增强文件传输可靠性

目标：让 100MB 以上文件在公网和移动端场景更稳定。

建议任务：

1. 给 chunk 引入 ack 和缺片检测。
2. 增加发送窗口和背压。
3. 增加接收端超时清理。
4. UI 展示接收进度和失败状态。

### 第四阶段：完善密码房间

目标：把密码房间从隐藏高级功能变成可理解的安全选项。

建议任务：

1. 用正式 modal 替代 `prompt`。
2. 明确密码不会写入链接，需要单独分享。
3. 在房间 UI 中区分普通房间和密码房间。
4. 通过加密握手或验证消息提示密码错误。

### 第五阶段：PWA 和移动体验

目标：让手机到桌面传输成为稳定主路径。

建议任务：

1. 增加安装提示和版本更新策略。
2. 明确离线状态和重连状态。
3. 优化移动端文件选择、发送中断和下载提示。
4. 检查 iOS Safari、Android Chrome、桌面 Chrome/Safari 的行为差异。

## 11. 开发约定与验证方式

建议后续开发遵守以下约定：

- 安全相关改动必须先写清楚威胁模型和服务端能看到什么。
- 更新项目认知时，优先同步 `docs/superpowers/specs/` 下的设计文档；如果内容会影响后续 agent 行为，再同步到 `AGENTS.md`。
- 不再把新的业务逻辑直接堆入 `App.tsx`。
- 文件传输协议字段应有类型定义，并尽量与 UI 状态分离。
- 客户端收到的所有网络 payload 都应做类型校验。
- UI 文案不能承诺实现没有做到的安全性质。
- 修改脚本时要验证启动、停止、状态检查三个路径。

当前最小验证命令：

```bash
npm run lint
npm run build
```

推荐手动验证清单：

1. 打开第一个设备，生成新房间。
2. 用二维码或复制链接打开第二个设备，确认文本互发。
3. 发送小文件，确认对方可下载。
4. 发送大于 10MB 的文件，确认分片路径可用。
5. 发送文件夹，确认 zip 文件名和内容正确。
6. 使用 4 位房间号加入，确认请求、批准、拒绝和过期状态。
7. 创建密码房间，确认无密码设备不能解密消息。
8. 刷新页面，确认文本历史保留、文件历史不承诺可下载。
9. 分别在移动端和桌面端检查输入框、键盘弹出和按钮布局。

## 12. 推荐下一步

下一步不建议直接加新功能。推荐先做一个小而关键的开发计划：

1. 修正安全模型说明，或者重设 4 位房间号加入协议。
2. 拆分 `App.tsx` 中最独立的展示组件。
3. 为房间号加入和消息加解密补最小测试或验证脚本。

这三个动作会让后续功能开发更稳，也能避免安全承诺继续偏离实际实现。
