# Drop UI Redesign Prompt for Claude Design

日期：2026-04-23

用途：把下面的提示词交给 Claude Design，用于重新设计 Drop 的完整产品 UI、设计系统、logo 和 SVG icon 资产。请不要参考当前实现的视觉风格，只保留产品目标、功能流程和安全边界。

---

## Claude Design 主提示词

你是一个资深产品设计师和设计系统工程师。请为 **Drop** 重新设计一个完整、可扩展、可实现的 Web/PWA UI。Drop 是一个端到端加密的跨设备文本、剪贴板、文件和文件夹传输工具，主要用于个人可信设备之间的临时传输，例如手机到 Mac、Mac 到手机、平板到桌面浏览器。

请完全忘记现有视觉设计。不要沿用当前页面的颜色、卡片样式、圆角、布局或 emoji favicon。你只需要保留产品功能和交互流程。最终输出应包含高保真界面方案、完整设计系统、组件规范、响应式规则、logo 方案和 SVG icon 文件方案，方便后续由工程师在 React + TypeScript + TailwindCSS 中实现。

不要做营销落地页。打开应用后的第一屏必须是可用的传输工作台，而不是介绍页。

## 产品定位

Drop 是一个“可信设备间的临时加密传输工作台”。它不是网盘，不是聊天软件，也不是团队协作平台。核心体验是：

- 快速建立同一房间。
- 一眼知道当前连接状态和设备数量。
- 用最少动作发送剪贴板文本、手动文本、单个文件、多个文件或文件夹。
- 通过二维码、链接或 4 位房间号让另一台设备加入。
- 清楚表达安全边界，不夸大当前协议能力。
- 在移动端保持极高效率，尤其是“粘贴并发送”和文件选择。

## 必须覆盖的页面和状态

这是一个单页应用，但需要设计成多个明确的屏幕状态和模块。

### 1. Desktop Transfer Workspace

设计桌面端主工作台，宽度覆盖 1024px、1280px、1440px。

必须包含：

- 品牌区：Drop logo、产品名、短状态文案。
- 当前房间区：二维码、分享链接复制、4 位房间号、房间号复制。
- 连接状态：在线/离线、当前设备数量、重连中状态。
- 安全状态：普通房间/密码房间标识；提示“本地加密传输”，避免绝对“服务器永远无法解密”的表述。
- 加入审批区：当有设备通过房间号请求加入时，显示请求设备、允许、拒绝。
- 快速加入区：输入 4 位房间号并发起加入请求。
- 消息/传输时间线：文本、Markdown 文本、文件卡片、不可下载历史文件、发送中、接收中、失败。
- 输入区：多行文本输入、发送、选择文件、发送文件夹、粘贴并发送。
- 自动复制开关：清楚表达风险，“其他应用可能读取剪贴板”。
- 清空历史：低强调危险操作，不要和主操作竞争。

推荐布局：

- 左侧为连接与房间控制区，宽 300-340px。
- 中间为消息/传输时间线和输入区。
- 可选右侧轻量 inspector，用于安全状态、当前传输详情或最近设备；如果空间不足，不要强行三栏。
- 工作台应像专业工具，不像聊天 App 的娱乐界面。

### 2. Mobile Quick Transfer Workspace

设计移动端主界面，覆盖 360px、390px、430px 宽度，考虑 iOS Safari 和 PWA standalone。

必须包含：

- 顶部紧凑状态栏：Drop mark、连接状态、设备数量、二维码/分享入口。
- 快速操作优先级：
  1. 粘贴并发送
  2. 选择文件
  3. 发送文件夹
  4. 手动输入文字
- 最近消息预览：只展示少量最近记录，并提供进入全部消息的入口。
- 全部消息页/面板：移动端需要单独的全屏消息列表状态。
- 输入法弹出时，输入区固定在键盘上方，不遮挡文本。
- 所有可点击目标至少 44px 高。

移动端不要把桌面侧栏硬塞进去。分享、房间号、加入审批、设置应进入 bottom sheet 或 full-screen sheet。

### 3. Connect Other Device Flow

设计“连接其他设备”弹窗或 sheet。

必须包含：

- 二维码。
- 分享链接，带复制按钮。
- 4 位房间号，视觉上便于读和口头传达。
- 密码房间标识。
- 简短说明：扫码或复制链接可加入；房间号加入需要当前设备确认。
- 关闭按钮、复制成功状态。

### 4. Join by Room Code Flow

设计通过 4 位房间号加入的完整状态：

- 输入 4 位数字。
- 输入不足/格式错误。
- 发起请求。
- 等待对方确认。
- 请求被允许。
- 请求被拒绝。
- 请求过期。
- 请求过于频繁。
- 房间不存在或已失效。

审批卡片必须让当前房间成员清楚知道：允许后，对方设备将获得当前房间的分享入口。

### 5. Password Room Flow

设计密码房间的创建和加入：

- 创建密码房间入口。
- 设置密码 modal，不使用浏览器 `prompt` 风格。
- 加入密码房间输入密码 modal。
- 密码房间状态标签。
- 密码错误或无法解密的反馈。
- 明确提示：密码不会写入链接，需要单独分享。

### 6. Transfer Progress and File States

设计文件传输相关状态：

- 文件选择后准备中。
- 文件夹压缩中。
- 加密发送中。
- 大文件分片发送中。
- 接收中。
- 发送完成。
- 下载可用。
- 历史文件不可下载。
- 超过 500MB 上限。
- 移动端大文件风险提醒。
- 失败重试入口的预留状态，即使当前实现暂未支持自动重试。

### 7. Error and Empty States

必须设计以下状态：

- 安全环境受限：浏览器不支持 `crypto.subtle` 或不在 HTTPS 安全上下文。
- Socket 断开。
- 房间链接校验失败。
- 消息解密失败。
- 空消息列表。
- 无活跃传输。
- localStorage 不可用或历史保存失败。

错误文案要具体、短、可行动。不要用泛泛的“发生错误”作为唯一反馈。

## 功能模块边界

请按以下模块组织设计，方便后续工程拆分组件：

- `BrandSystem`：logo、wordmark、favicon、app icon、品牌色。
- `AppShell`：桌面和移动端外层布局。
- `RoomIdentityPanel`：二维码、链接、房间号、密码房间状态。
- `ConnectionStatus`：在线、离线、重连、设备数量。
- `JoinByCode`：输入房间号、请求状态、错误状态。
- `JoinApprovalQueue`：加入请求列表、允许、拒绝。
- `SecurityNotice`：本地加密、密码房间、剪贴板风险、安全边界提示。
- `TransferTimeline`：消息和文件事件流。
- `MessageBubble`：短文本、长文本、Markdown、复制、展开。
- `FileTransferCard`：文件名、大小、类型、进度、下载、失败。
- `Composer`：文本输入、发送、粘贴并发送、选择文件、发送文件夹。
- `ProgressOverlay`：压缩、加密、发送、接收。
- `SettingsSheet`：自动复制、清空历史、密码房间入口、安全说明。
- `ToastSystem`：成功、警告、错误、信息。

每个模块都要定义默认、hover、focus、active、disabled、loading、error 状态。

## 交互边界

请在设计中明确以下交互规则：

- 文本为空时发送按钮 disabled。
- Enter 发送，Shift+Enter 换行；移动端不强调键盘快捷键。
- 粘贴并发送需要浏览器剪贴板权限，失败时显示可行动提示。
- 自动复制关闭时，不自动写入剪贴板。
- 自动复制开启时，收到文本后低调提示“已复制”。
- 选择文件支持多选。
- 发送文件夹会先压缩成 zip。
- 任何总大小超过 500MB 的文件选择必须被阻止。
- 房间号只接受 4 位数字。
- 已有待确认加入请求时，不允许重复发起。
- 加入审批允许/拒绝后，卡片从队列移除。
- 清空历史需要确认，但确认 UI 不要打断主要传输流程。
- 页面刷新后，文本历史可见，文件二进制不可下载；UI 要能表达这一点。
- 断线时仍可查看历史，但不能发送新消息。

## 安全文案边界

安全表达必须准确。当前产品有客户端加密，但 4 位房间号加入流程在无密码房间里涉及服务端临时转发分享入口，所以不要在 UI 中做绝对化承诺。

推荐表达：

- “本地加密后传输”
- “房间链接包含访问密钥，请只分享给可信设备”
- “房间号加入需要当前设备确认”
- “密码房间需要链接和密码两部分”
- “文件仅在本次会话中可下载”

避免表达：

- “服务器永远无法解密”
- “绝对零知识”
- “任何情况下都安全”
- “房间号等同安全密码”

## 设计系统要求

### 视觉方向

目标气质：安静、快速、可信、专业，有清晰的信息密度。它应该像一个精致的系统工具，而不是社交聊天 App 或营销页面。

关键词：

- Quiet utility
- Secure handoff
- Fast local workflow
- Cross-device control
- Precise status

不要使用当前视觉的 emerald/zinc 大面积组合。不要使用 emoji 作为 logo。不要使用大面积紫蓝渐变、玻璃拟态、漂浮光球、bokeh 背景或纯氛围背景。不要把页面区块都做成大卡片堆叠。

### 色彩规范

请定义完整 token，并给出 light/dark mode。

推荐方向：

- Neutral Ink：用于主文字和主背景。
- Transfer Blue：主操作和连接状态，冷静、技术感。
- Secure Green：仅用于安全成功状态，不作为全局唯一主色。
- Caution Amber：密码、权限、等待确认。
- Danger Red：拒绝、失败、清空历史、断开。
- File Violet 或 Data Cyan：用于文件传输状态，但用量克制。

需要输出：

- `color.background.canvas`
- `color.background.surface`
- `color.background.elevated`
- `color.text.primary`
- `color.text.secondary`
- `color.text.muted`
- `color.border.subtle`
- `color.border.strong`
- `color.action.primary`
- `color.action.primaryHover`
- `color.status.online`
- `color.status.offline`
- `color.status.warning`
- `color.status.danger`
- `color.transfer.progress`
- `color.security.password`
- `color.focus.ring`

每个 token 给出 HEX 值，并说明使用场景。

### 字体、字号、字重

字体：

- 英文和数字：`Inter` 或 `SF Pro`
- 中文：`PingFang SC`、`Noto Sans SC`、系统 sans-serif fallback
- 等宽数字：用于房间号、文件大小、进度，可使用 `SF Mono` 或 `ui-monospace`

字号体系：

- 11px：辅助标签、元信息、状态提示。
- 12px：次级说明、chip、toast。
- 14px：默认正文、按钮、输入。
- 16px：重要正文、移动端主按钮。
- 20px：section title 或 modal title。
- 28px：桌面主标题或品牌展示。
- 32px：房间号展示。

字重：

- 400 regular：正文。
- 500 medium：按钮、标签、列表标题。
- 600 semibold：模块标题、关键数值。
- 700 bold：只用于品牌或强强调。

不要使用负 letter-spacing。不要用 viewport width 缩放字体。

### 间距和布局

间距 scale：

- 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px

圆角：

- 小控件：6px
- 卡片/面板：8px
- modal/sheet：10px 或 12px
- pill/chip：999px，仅用于状态标签，不用于主要按钮

边框和阴影：

- 默认用 1px subtle border 区分层级。
- 阴影只用于 modal、sheet、toast、拖拽/浮层。
- 不要用重阴影营造卡片堆叠感。

响应式：

- Mobile：360-430px
- Tablet：768px
- Desktop：1024px+
- Wide：1440px+

固定格式元素要有稳定尺寸：二维码、icon button、房间号框、进度条、文件卡片、底部输入栏不能因状态文字变化而跳动。

## UI 组件规范

请设计并命名以下组件：

### Buttons

- PrimaryButton：发送、粘贴并发送、允许加入。
- SecondaryButton：选择文件、发送文件夹、复制链接。
- DangerButton：拒绝、清空历史。
- IconButton：复制、二维码、关闭、下载、删除、展开/收起。
- SplitAction 或 ActionGroup：桌面输入区的文件/文件夹入口。

按钮需要定义 icon 位置、loading、disabled、focus ring。

### Inputs

- TextAreaComposer：多行文本输入。
- RoomCodeInput：4 位数字，分组显示或单框显示均可，但必须容易复制和口头传达。
- PasswordInput：密码房间输入，带显示/隐藏 icon。
- ReadonlyLinkInput：分享链接展示和复制。

### Toggles and Controls

- AutoCopyToggle：自动复制开关。
- SecurityBadge：普通房间、密码房间、本地加密。
- ConnectionBadge：在线、离线、重连中。
- DeviceCountBadge：当前设备数量。

### Cards and Rows

- MessageBubble
- MarkdownMessage
- FileCard
- TransferProgressCard
- JoinRequestCard
- ActiveRoomRow
- EmptyState
- ErrorState

### Overlays

- ConnectDeviceSheet
- PasswordRoomModal
- JoinRequestSheet
- AllMessagesMobileSheet
- ProgressOverlay
- ConfirmClearHistoryDialog
- Toast

## Logo 和 SVG Icon 要求

请设计一个新的 Drop 品牌系统，不能使用 emoji。

### Logo 方向

核心隐喻：一次安全、轻量、跨设备的“投递”。

可探索符号：

- 一个极简包裹/文件片，被向下或向前投递。
- 包裹上有一个小锁、密钥孔或 shield cutout。
- 两个设备之间的短距离传输轨迹。
- 一个几何化的 D 字母，内部包含 drop/packet/arrow。

避免：

- 真实水滴图标，容易误解为天气或清洁产品。
- 复杂 3D 盒子。
- emoji 包裹。
- 过度安全软件化的盾牌 logo。

### 需要输出的 SVG 文件方案

请在设计交付中提供以下 SVG 资产的代码或清晰规范：

- `src/assets/brand/drop-mark.svg`：24x24 和 32x32 可读的单色/双色 mark。
- `src/assets/brand/drop-logo.svg`：包含 mark + Drop wordmark 的横向 logo。
- `src/assets/brand/drop-app-icon.svg`：适合 PWA manifest 的 512x512 app icon。
- `src/assets/icons/send.svg`
- `src/assets/icons/file-up.svg`
- `src/assets/icons/folder-up.svg`
- `src/assets/icons/download.svg`
- `src/assets/icons/copy.svg`
- `src/assets/icons/qr-code.svg`
- `src/assets/icons/shield-check.svg`
- `src/assets/icons/lock.svg`
- `src/assets/icons/wifi.svg`
- `src/assets/icons/wifi-off.svg`
- `src/assets/icons/check.svg`
- `src/assets/icons/x.svg`
- `src/assets/icons/trash.svg`
- `src/assets/icons/chevron-down.svg`
- `src/assets/icons/chevron-up.svg`

SVG 规范：

- `viewBox="0 0 24 24"`，除 app icon 外。
- 使用 `currentColor`，除 logo/app icon 可使用设计 token 色。
- stroke width 1.75 或 2，round cap/join。
- 图标在 16px、20px、24px 都清晰。
- 图标命名和组件语义一致，不要依赖第三方 icon 库名称。

## 可访问性要求

- 所有交互元素有可见 focus state。
- 颜色对比符合 WCAG AA。
- 不只依赖颜色表达状态，状态需要文字或 icon。
- 动画提供 reduced-motion 替代。
- Toast 不应遮挡关键输入。
- Modal/sheet 有明确标题、关闭入口和键盘焦点管理。
- 移动端触控目标不小于 44px。
- 二维码旁必须有文本链接复制入口。

## 文案风格

中文优先，英文仅用于品牌和技术短词。文案短、清楚、行动导向。

推荐语气：

- “已连接”
- “等待确认”
- “复制链接”
- “粘贴并发送”
- “文件仅本次会话可下载”
- “房间链接包含访问密钥，请只分享给可信设备”

避免：

- 大段解释。
- 营销口号。
- 空泛安全承诺。
- 在 UI 中解释键盘快捷键或视觉设计。

## 交付格式

请输出以下内容：

1. 设计方向概述：用 5-8 句话描述整体视觉和体验原则。
2. 设计系统：颜色 token、字体、字号、字重、间距、圆角、阴影、动画。
3. 页面/状态清单：桌面、移动端、弹窗、异常状态。
4. 核心组件规范：每个组件的用途、状态、尺寸和交互。
5. Logo 方案：至少 2 个方向，并推荐 1 个。
6. SVG icon 资产：给出可实现的 SVG 规范，关键图标提供代码样例。
7. 响应式规则：桌面、移动端、键盘弹出、PWA standalone。
8. 实现备注：给 React + Tailwind 工程师的组件拆分建议。

## 设计约束

- 不要输出营销页。
- 不要使用现有 UI 的视觉风格。
- 不要把所有区域都做成大圆角卡片。
- 不要使用 emoji 作为 logo 或 app icon。
- 不要使用大面积渐变、玻璃拟态、漂浮装饰球。
- 不要让按钮文字在移动端溢出。
- 不要让状态文字变化造成布局跳动。
- 不要把安全声明说得超过当前协议能力。

最终设计应该让用户感觉：这是一个快、稳、可信的私人传输工具。用户打开后能立刻发送内容，也能清楚知道当前房间、连接、安全和传输状态。
