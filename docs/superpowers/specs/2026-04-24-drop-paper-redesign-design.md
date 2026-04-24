# Drop Paper Redesign Design

## 1. 背景

`drop-design/` 已提供完整的 Claude Design 回传稿，其中包含：

- `agentreadme.md`：设计到代码的实现契约
- `tokens.jsx`：light / dark token 真源
- `icons.jsx`：24 个 duotone 图标真源
- `workspace-paper.jsx`：推荐的桌面与移动端布局
- `modals.jsx`：连接、加入、密码房间、传输状态、toast、错误态
- `src/assets/brand/*`：品牌 SVG 真源

该交付物明确指定只落地 `B · Paper / Document` 方向，禁止混入 `Terminal` 和 `Modern OS` 两个探索方向。

本次工作目标是在不改变现有加密、房间、Socket、文件分片协议语义的前提下，对 Drop 前端进行一次完整的 Paper 风格重构，并尽可能按设计稿 100% 还原。

## 2. 目标

- 将当前前端从单文件、聊天气泡导向的界面重构为 `B · Paper` 设计体系
- 保留现有业务能力：建房、扫码/链接加入、房间号加入、审批、文本发送、文件/文件夹发送、下载、密码房间、历史清空
- 将设计稿中的关键状态全部接入真实业务状态，而不是静态展示
- 建立可持续扩展的前端结构，为后续继续扩展设计或增加状态页提供清晰边界

## 3. 非目标

- 不实现 `workspace-terminal.jsx`
- 不实现 `workspace-os.jsx`
- 不把 A/B/C 三套方向做成应用内主题切换
- 不重写后端协议、房间逻辑或加密算法
- 不在本次重构里重新定义 README 中的安全承诺

## 4. 方案比较

### 方案 A：外壳重建，业务逻辑保留

保留现有业务状态、Socket 事件、加解密和文件传输逻辑；重建 UI 壳层、展示组件和状态编排。

优点：

- 最接近设计稿的完整还原
- 风险主要集中在前端，后端协议不动
- 后续可维护性最好

缺点：

- 改动面较大，基本属于前端重构

### 方案 B：在现有 `App.tsx` 上直接换皮

继续沿用单文件结构，只替换布局和视觉样式。

优点：

- 初始改动快

缺点：

- 很难达到高还原度
- 状态、布局、移动端 sheet 会继续纠缠在一起
- 后续维护成本高

### 方案 C：先静态复刻，再回接业务

先把设计稿做成静态 React 界面，再逐步回接真实业务状态。

优点：

- 最快得到视觉接近稿

缺点：

- 会出现一段不可用中间态
- 容易产生重复工作

### 结论

采用 **方案 A：外壳重建，业务逻辑保留**。

## 5. 实现边界

本次只实现 `B · Paper / Document`，覆盖以下内容：

- 桌面端三栏工作台
  - 左栏 `340px`
  - 中栏 `1fr`
  - 右栏 `320px`
- 移动端 `PaperMobile`
- 顶部 `Letterhead`
- 左侧房间身份区、设备列表、房间号加入区
- 中间传输时间线、过滤器、固定 composer
- 右侧安全状态、事实表、偏好开关、清空历史
- 设计稿中的 overlay / modal / sheet / toast / error / empty / dark mode

以下内容必须继续工作：

- 通过链接加入
- 通过二维码加入
- 通过 4 位房间号加入并等待审批
- 审批房间号加入请求
- 发送文本
- 粘贴并发送
- 发送文件
- 发送文件夹
- 下载文件
- 密码房间创建与加入
- 清空历史

## 6. 设计原则

本次实现遵守以下 Paper 方向约束：

- 单一深墨蓝主操作色，不引入新的主色
- 暖纸色背景与明确的文档式层级
- 传输记录以编号时间线呈现，不再以聊天气泡作为主视觉
- 优先使用 1px 边框和版式层级建立结构，而不是大阴影或装饰效果
- 禁止引入渐变、玻璃拟态、浮动光晕、营销式 hero、夸张圆角卡片

## 7. 前端架构

前端重构为三层：

### 7.1 壳层

职责：负责布局、断点切换、portal、全局显示编排，不承载业务协议细节。

计划组件：

- `AppShell`
- `DesktopShell`
- `MobileShell`
- `Letterhead`

### 7.2 业务 hook 层

职责：把当前 `App.tsx` 中的状态整理成可供展示组件消费的数据模型。

计划 hooks：

- `useDropSession`
- `useTransferTimeline`
- `useJoinByCode`
- `useRoomSecurity`
- `useViewportComposer`

### 7.3 展示组件层

职责：纯粹消费状态并按 Paper 设计系统渲染。

计划模块：

- `Brand/DropLogo`
- `Shell/Letterhead`
- `Sidebar/RoomIdentityPanel`
- `Sidebar/DevicesList`
- `Sidebar/JoinByCodePanel`
- `Timeline/TransferTimeline`
- `Timeline/TimelineEntry`
- `Timeline/TextEntry`
- `Timeline/FileEntry`
- `Composer/ComposerPanel`
- `Inspector/SecurityNotice`
- `Inspector/SecurityFacts`
- `Inspector/PreferencesPanel`
- `Overlays/ConnectDeviceSheet`
- `Overlays/PasswordRoomModal`
- `Overlays/JoinApprovalCard`
- `Overlays/TransferStateSheet`
- `Feedback/ToastStack`
- `Feedback/EmptyState`
- `Feedback/ErrorState`

## 8. 现有状态到新结构的映射

### `useDropSession`

管理以下状态：

- `socket`
- `roomId`
- `cryptoKey`
- `isConnected`
- `peersCount`
- `activeRooms`

职责：

- 当前会话是否连通
- 房间身份信息
- 已加入设备数量
- 与连接状态相关的 UI 文案

### `useTransferTimeline`

管理以下状态：

- `messages`
- `uploadProgress`
- `isSending`
- `isZipping`
- `incomingChunks`

职责：

- 将文本、文件、代码块统一映射为编号时间线条目
- 表达 preparing / zipping / sending / done / history / failed 等状态
- 驱动下载按钮、进度条、长文本展开、Markdown 渲染

### `useJoinByCode`

管理以下状态：

- `roomCode`
- `joinCodeInput`
- `isJoinRequestPending`
- `pendingJoinRequestId`
- `incomingJoinRequests`

职责：

- 房间号输入区
- 请求提交状态
- 等待审批倒计时和反馈
- 审批列表与审批卡片

### `useRoomSecurity`

管理以下状态：

- `needsPassword`
- `hasPassword`
- `passwordInput`
- `autoCopyToClipboard`

职责：

- 密码房间创建与加入
- 自动复制开关
- 安全说明和状态面板

### `useViewportComposer`

管理以下状态：

- `keyboardOpen`
- `viewportHeight`
- `textareaRef`

职责：

- 移动端键盘弹出时将 composer 固定在可视区域上方
- 管理输入框高度与视口联动

## 9. 版式定义

### 桌面端

- 顶部采用 `Letterhead`，带明显底边线
- 主区域为三栏结构
- 左栏放房间、设备、房间号加入
- 中栏放时间线与固定 composer
- 右栏放安全状态、事实表、偏好设置、清空历史

时间线规则：

- 每条记录采用编号 gutter
- 文本、文件、代码块统一进入同一时间线
- 左右方向通过边线与元信息表达，不回到聊天气泡结构

### 平板端

- 右侧 inspector 改为 drawer
- 左栏缩窄但保留
- composer 继续固定底部

### 移动端

- 单栏布局
- `Paste & Send` 为最高优先级操作
- 连接设备、设置、全量记录使用底部 sheet
- 保证触控尺寸不小于 `44x44`
- 处理 `safe-area-inset-top` 与 `safe-area-inset-bottom`

## 10. 设计系统落地

### Token

建立以下文件：

- `src/theme/tokens.ts`
- `src/theme/utils.ts`

其中：

- `tokens.jsx` 中的 `dropTokens.light / dark` 原样迁移为 TypeScript 常量
- 字体、字号、间距、圆角、阴影原样迁移
- 所有组件只能消费设计 token，不允许自行发明颜色或阴影

### 全局样式

在 `src/index.css` 中定义：

- `:root` light token CSS variables
- dark theme variables
- 字体变量
- body / button / input / textarea 基础样式
- 统一 focus ring
- safe area 辅助样式

### 设计系统硬约束

- 不使用新的渐变
- 不保留当前绿主色聊天体系
- 时间、房间号、文件大小、百分比等数字统一使用等宽字体
- `pill` 只用于 badge，不用于常规按钮

## 11. 资源迁移规则

### 品牌资源

以 `drop-design/src/assets/brand/*` 为真源，迁移到：

- `src/assets/brand/drop-mark.svg`
- `src/assets/brand/drop-logo.svg`
- `src/assets/brand/drop-app-icon.svg`

同时实现 `DropLogo` React 组件，支持：

- `mark`
- `wordmark`
- `app-icon`

品牌主标识应以 SVG 组件或内联方式使用，避免在核心 UI 中依赖不透明位图。

### 图标资源

以 `drop-design/icons.jsx` 为真源，迁移 24 个图标到本地组件：

- `src/components/icons/*.tsx`
- `src/components/icons/index.ts`

规则：

- 路径、stroke、duotone 结构按设计稿复制
- 命名按设计稿导出名保留
- 新 UI 主路径中不再混用 `lucide-react`

## 12. 关键状态与交互

以下状态必须是可真实触发状态，而不是静态摆设：

### 连接状态

- 已连接
- 未连接
- 设备数量变化

### 房间号加入状态

- 默认输入
- 等待对方确认
- 被拒绝
- 输入错误

### 密码房间状态

- 创建密码房间
- 输入密码加入
- 密码错误

### 传输状态

- preparing
- zipping
- uploading progress
- done
- history
- failed
- too large

### 反馈状态

- success toast
- warning toast
- error toast
- empty state
- clear history confirm

## 13. 安全文案边界

Paper redesign 期间不得引入超出当前实现能力的安全宣称。

允许的表述：

- 本地加密后传输
- 房间链接包含访问密钥
- 房间号加入需要当前设备确认
- 文件仅本次会话可下载

避免的表述：

- 服务器永远无法解密
- 绝对零知识
- 任何情况下都安全

`SecurityNotice` 只表达“本地加密已启用”，不表达超出当前真实能力的端到端承诺。

## 14. 实现顺序

建议按以下顺序执行：

1. 接入 token、字体、品牌、图标
2. 重建桌面 `PaperWorkspace`
3. 重建移动端 `PaperMobile`
4. 接入 overlay / modal / toast / error / empty state
5. 接入 dark mode
6. 最后做细节校准和回归验证

## 15. 验收标准

### 功能验收

- `npm run lint` 通过
- `npm run build` 通过
- 建房、链接加入、二维码加入、房间号加入、审批、文本发送、文件发送、文件夹发送、下载、密码房间、清空历史全部可用

### 视觉验收

- 桌面、常规宽度、移动端至少三档截图检查
- 三栏宽度与 letterhead 符合设计
- 时间线编号 gutter、固定 composer、右侧 inspector 层级准确
- 字体、字号、mono 数字、按钮层级、边框、阴影均遵循 token

### 资源验收

- 主 UI 中不再混用 `lucide-react`
- 品牌与图标均来自 `drop-design` 真源

### 结构验收

- `App.tsx` 不再承载大部分 UI 细节
- 主要展示组件和业务 hook 已拆分

### 回归风险验收

- iOS/移动端键盘顶起 composer
- 长文本 Markdown 展开/收起
- 大文件上传进度展示
- 历史记录显示
- dark mode 对比度与可读性

## 16. 风险

- 当前 `App.tsx` 业务与展示高度耦合，第一次拆分容易在事件绑定或状态归属上出现回归
- `drop-design` 当前是未跟踪目录，实施时需避免误提交设计源文件，除非后续明确要纳入仓库
- 图标从 `lucide-react` 切换到本地图标组件后，需特别检查尺寸和对齐
- 移动端键盘、sheet、safe area 是最容易出现细节偏差的区域

## 17. 决策

- 采用 `B · Paper / Document` 作为唯一落地方向
- 采用“外壳重建，业务逻辑保留”的实现路径
- 将设计系统、品牌和图标迁移为本地真源，避免实现过程继续漂移
- 以真实业务状态驱动设计稿中的所有关键状态页
