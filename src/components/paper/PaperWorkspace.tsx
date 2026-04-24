import { type ChangeEvent, type KeyboardEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { DropLogo } from "../brand/DropLogo";
import { DropIcons, type DropIconName } from "../icons";
import { looksLikeMarkdown } from "../../lib/drop";
import { cn } from "../../lib/utils";
import type { Message, PendingRoomCodeJoinRequest, UploadProgress } from "../../types/drop";

export type MessageFilter = "all" | "text" | "file" | "unread";

interface PaperWorkspaceProps {
  session: {
    socketId?: string;
    roomCode: string;
    shareUrl: string;
    isConnected: boolean;
    peersCount: number;
    hasPassword: boolean;
    joinRequestExpiresAt: number | null;
    incomingJoinRequests: PendingRoomCodeJoinRequest[];
  };
  security: {
    needsPassword: boolean;
    passwordInput: string;
    autoCopyToClipboard: boolean;
    confirmLargeMobileTransfers: boolean;
    isDarkMode: boolean;
    createPasswordDraft: string;
    showCreatePasswordModal: boolean;
    onPasswordInputChange: (value: string) => void;
    onSubmitPassword: () => void;
    onToggleAutoCopy: () => void;
    onToggleConfirmLargeTransfers: () => void;
    onToggleDarkMode: () => void;
    onOpenCreatePasswordModal: () => void;
    onCloseCreatePasswordModal: () => void;
    onCreatePasswordDraftChange: (value: string) => void;
    onCreatePasswordRoom: () => void;
  };
  join: {
    joinCodeInput: string;
    digitSlots: string[];
    isJoinRequestPending: boolean;
    onJoinCodeChange: (value: string) => void;
    onJoinByCode: () => void;
    onApproveJoinRequest: (requestId: string) => void;
    onRejectJoinRequest: (requestId: string) => void;
  };
  transfer: {
    messages: Message[];
    textInput: string;
    copiedId: string | null;
    isSending: boolean;
    isZipping: boolean;
    uploadProgress: UploadProgress | null;
    pendingLargeTransfer: {
      title: string;
      description: string;
      confirmLabel: string;
    } | null;
    fileInputRef: RefObject<HTMLInputElement | null>;
    folderInputRef: RefObject<HTMLInputElement | null>;
    desktopTextareaRef: RefObject<HTMLTextAreaElement | null>;
    mobileTextareaRef: RefObject<HTMLTextAreaElement | null>;
    onTextInputChange: (value: string) => void;
    onSendText: () => void;
    onFileInput: (event: ChangeEvent<HTMLInputElement>) => void;
    onFolderInput: (event: ChangeEvent<HTMLInputElement>) => void;
    onCopy: (text: string, messageId: string) => void;
    onPasteAndSend: () => void;
    onDownload: (fileData: ArrayBuffer, fileName: string, fileType: string) => void;
    onClearMessages: () => void;
    onConfirmPendingLargeTransfer: () => void;
    onCancelPendingLargeTransfer: () => void;
    formatFileSize: (bytes: number) => string;
  };
  ui: {
    errorToast: string | null;
    keyboardOpen: boolean;
    viewportHeight: number;
    showConnectSheet: boolean;
    showAllMessages: boolean;
    showClearHistoryConfirm: boolean;
    messageFilter: MessageFilter;
    onDismissToast: () => void;
    onOpenConnectSheet: () => void;
    onCloseConnectSheet: () => void;
    onOpenAllMessages: () => void;
    onCloseAllMessages: () => void;
    onOpenClearHistoryConfirm: () => void;
    onCloseClearHistoryConfirm: () => void;
    onMessageFilterChange: (filter: MessageFilter) => void;
  };
}

type TimelineItem =
  | { kind: "message"; message: Message }
  | { kind: "progress"; progress: UploadProgress; isZipping: boolean };

const FILTERS: Array<{ key: MessageFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "text", label: "文本" },
  { key: "file", label: "文件" },
  { key: "unread", label: "未读" },
];

export function PaperWorkspace({ session, security, join, transfer, ui }: PaperWorkspaceProps) {
  const [joinTicker, setJoinTicker] = useState(Date.now());
  const mobileJoinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!join.isJoinRequestPending || !session.joinRequestExpiresAt) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setJoinTicker(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [join.isJoinRequestPending, session.joinRequestExpiresAt]);

  const joinCountdown = useMemo(() => {
    if (!session.joinRequestExpiresAt) {
      return 0;
    }

    return Math.max(0, Math.ceil((session.joinRequestExpiresAt - joinTicker) / 1000));
  }, [joinTicker, session.joinRequestExpiresAt]);

  const totalTransferSize = useMemo(
    () => transfer.messages.reduce((sum, message) => sum + (message.fileSize ?? 0), 0),
    [transfer.messages],
  );

  const filteredMessages = useMemo(() => {
    return transfer.messages.filter((message) => {
      if (ui.messageFilter === "all") return true;
      if (ui.messageFilter === "text") return message.type === "text";
      if (ui.messageFilter === "file") return message.type === "file";
      return !isOwnMessage(message.senderId, session.socketId);
    });
  }, [session.socketId, transfer.messages, ui.messageFilter]);

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = filteredMessages.map((message) => ({
      kind: "message",
      message,
    }));

    if (transfer.uploadProgress && (ui.messageFilter === "all" || ui.messageFilter === "file")) {
      items.push({
        kind: "progress",
        progress: transfer.uploadProgress,
        isZipping: transfer.isZipping,
      });
    }

    return items;
  }, [filteredMessages, transfer.isZipping, transfer.uploadProgress, ui.messageFilter]);

  const recentMessages = useMemo(() => transfer.messages.slice(-3).reverse(), [transfer.messages]);

  const desktopDeviceRows = useMemo(() => buildDeviceRows(session.peersCount), [session.peersCount]);
  const todayStamp = useMemo(() => formatDateStamp(new Date()), []);
  const currentTime = useMemo(() => formatTimeStamp(new Date()), []);

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <HiddenTransferInputs
        fileInputRef={transfer.fileInputRef}
        folderInputRef={transfer.folderInputRef}
        onFileInput={transfer.onFileInput}
        onFolderInput={transfer.onFolderInput}
      />

      {ui.errorToast ? <ToastBanner message={ui.errorToast} onClose={ui.onDismissToast} /> : null}

      {session.incomingJoinRequests.length > 0 ? (
        <ApprovalDialog
          requests={session.incomingJoinRequests}
          onApprove={join.onApproveJoinRequest}
          onReject={join.onRejectJoinRequest}
        />
      ) : null}

      {ui.showConnectSheet ? (
        <ConnectSheet
          roomCode={session.roomCode}
          shareUrl={session.shareUrl}
          hasPassword={session.hasPassword}
          copiedId={transfer.copiedId}
          onClose={ui.onCloseConnectSheet}
          onCopy={transfer.onCopy}
        />
      ) : null}

      {security.needsPassword ? (
        <PasswordRoomDialog
          mode="join"
          value={security.passwordInput}
          onChange={security.onPasswordInputChange}
          onClose={() => {}}
          onSubmit={security.onSubmitPassword}
        />
      ) : null}

      {security.showCreatePasswordModal ? (
        <PasswordRoomDialog
          mode="create"
          value={security.createPasswordDraft}
          onChange={security.onCreatePasswordDraftChange}
          onClose={security.onCloseCreatePasswordModal}
          onSubmit={security.onCreatePasswordRoom}
        />
      ) : null}

      {ui.showClearHistoryConfirm ? (
        <ConfirmDialog
          title="清空本次会话历史"
          description="只会删除当前浏览器中的本地记录，不会撤回已经发送到其他设备的内容。"
          confirmLabel="清空"
          danger
          onCancel={ui.onCloseClearHistoryConfirm}
          onConfirm={() => {
            transfer.onClearMessages();
            ui.onCloseClearHistoryConfirm();
          }}
        />
      ) : null}

      {transfer.pendingLargeTransfer ? (
        <ConfirmDialog
          title={transfer.pendingLargeTransfer.title}
          description={transfer.pendingLargeTransfer.description}
          confirmLabel={transfer.pendingLargeTransfer.confirmLabel}
          onCancel={transfer.onCancelPendingLargeTransfer}
          onConfirm={transfer.onConfirmPendingLargeTransfer}
        />
      ) : null}

      {transfer.isSending || transfer.isZipping ? (
        <TransferDialog
          progress={transfer.uploadProgress}
          isZipping={transfer.isZipping}
          formatFileSize={transfer.formatFileSize}
        />
      ) : null}

      {ui.showAllMessages ? (
        <AllMessagesSheet
          items={timelineItems}
          socketId={session.socketId}
          copiedId={transfer.copiedId}
          formatFileSize={transfer.formatFileSize}
          onClose={ui.onCloseAllMessages}
          onCopy={transfer.onCopy}
          onDownload={transfer.onDownload}
        />
      ) : null}

      <div className="hidden min-h-[100dvh] flex-col lg:flex">
        <header className="border-b-2 border-[var(--text-primary)] bg-[var(--bg-surface)] px-10 pt-5 pb-4">
          <div className="flex items-end justify-between gap-6">
            <div className="flex items-center gap-3.5">
              <DropLogo size={36} />
              <div>
                <div className="paper-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  安全传输工作台 · Secure handoff
                </div>
                <div className="text-[22px] font-semibold leading-none tracking-[-0.02em]">Drop</div>
              </div>
            </div>
            <div className="flex gap-8">
              <StampField label="SESSION" value={session.roomCode || "----"} big mono />
              <StampField label="STATUS" value={session.isConnected ? "已连接" : "离线"} dot={session.isConnected} />
              <StampField label="DEVICES" value={String(Math.max(session.peersCount, 1))} big mono />
              <StampField label="DATE" value={todayStamp} mono />
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)_320px]">
          <aside className="overflow-y-auto border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] px-7 py-6">
            <SectionRule number="01" label="当前房间" />
            <div className="rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
              <div className="mb-3.5 flex justify-center">
                <div className="rounded-[4px] border border-[var(--border-medium)] bg-[var(--bg-elevated)] p-1.5">
                  <QRCodeSVG value={session.shareUrl} size={120} bgColor="transparent" fgColor="currentColor" />
                </div>
              </div>
              <div className="mb-3 text-center">
                <div className="paper-mono text-[9px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  房间号 · ROOM CODE
                </div>
                <div className="paper-mono mt-1 pl-[0.625rem] text-[32px] font-semibold tracking-[0.625rem] text-[var(--action-primary)]">
                  {(session.roomCode || "----").split("").join(" ")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => transfer.onCopy(session.shareUrl, "share-url")}
                className="flex w-full items-center justify-between gap-2 rounded-[4px] bg-[var(--bg-inset)] px-2.5 py-2 text-left paper-mono text-[10.5px] text-[var(--text-secondary)]"
              >
                <span className="truncate">{truncateMiddle(session.shareUrl, 26, 12)}</span>
                <IconWrap icon={transfer.copiedId === "share-url" ? "check" : "copy"} size={14} />
              </button>
              <div className="mt-3 flex gap-2">
                <PaperActionButton icon="qr" label="展开二维码" flex onClick={ui.onOpenConnectSheet} />
                <PaperActionButton
                  icon={transfer.copiedId === "room-code" ? "check" : "copy"}
                  label={`复制 ${session.roomCode || "房间号"}`}
                  flex
                  onClick={() => transfer.onCopy(session.roomCode, "room-code")}
                  disabled={!session.roomCode}
                />
              </div>
            </div>

            <div className="h-6" />
            <SectionRule number="02" label={`设备 · ${Math.max(session.peersCount, 1)}`} />
            <div className="space-y-2">
              {desktopDeviceRows.map((device) => (
                <DeviceRow key={device.id} {...device} />
              ))}
            </div>

            <div className="h-6" />
            <SectionRule number="03" label="加入房间" />
            <DigitSlotsInput
              value={join.joinCodeInput}
              digits={join.digitSlots}
              onChange={join.onJoinCodeChange}
              onSubmit={join.onJoinByCode}
              pending={join.isJoinRequestPending}
            />
            <div className="mt-3 text-[11.5px] leading-6 text-[var(--text-muted)]">
              输入 4 位房间号发起加入请求。对方设备确认后生效。
            </div>
            {join.isJoinRequestPending ? (
              <div className="mt-3 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-[8px] bg-[rgba(180,116,42,0.12)] p-2 text-[var(--security-password)]">
                    <DropIcons.clock size={18} />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold">等待对方确认</div>
                    <div className="paper-mono mt-1 text-[11px] text-[var(--text-muted)]">
                      房间 {join.joinCodeInput || "----"} · 剩余 {joinCountdown}s
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[var(--bg-inset)]">
                  <div
                    className="h-full bg-[var(--security-password)] transition-[width]"
                    style={{ width: `${Math.min((joinCountdown / 60) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </aside>

          <main className="flex min-h-0 flex-col bg-[var(--bg-canvas)]">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-10 py-5">
              <div>
                <div className="paper-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  传输记录 · TRANSFER LOG
                </div>
                <div className="mt-1 text-[14px] text-[var(--text-primary)]">
                  本次会话 · {transfer.messages.length} 项条目 · 共{" "}
                  <span className="paper-mono">{transfer.formatFileSize(totalTransferSize)}</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                {FILTERS.map((filter) => (
                  <FilterChip
                    key={filter.key}
                    label={filter.label}
                    active={ui.messageFilter === filter.key}
                    onClick={() => ui.onMessageFilterChange(filter.key)}
                  />
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-10 pt-5 pb-4">
              {timelineItems.length > 0 ? (
                <div className="flex flex-col gap-3.5">
                  {timelineItems.map((item, index) => (
                    <TimelineEntry
                      key={item.kind === "message" ? item.message.id : `progress-${item.progress.fileName}`}
                      item={item}
                      number={String(index + 1).padStart(3, "0")}
                      socketId={session.socketId}
                      copiedId={transfer.copiedId}
                      formatFileSize={transfer.formatFileSize}
                      onCopy={transfer.onCopy}
                      onDownload={transfer.onDownload}
                    />
                  ))}
                </div>
              ) : (
                <EmptyLogState filter={ui.messageFilter} />
              )}
            </div>

            <div className="px-10 pb-6">
              <div className="overflow-hidden rounded-[8px] border border-[var(--border-medium)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)]">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2">
                  <span className="paper-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    {String(transfer.messages.length + 1).padStart(3, "0")} · 正在撰写
                  </span>
                  <span className="paper-mono text-[10px] text-[var(--text-muted)]">{transfer.textInput.length} / 2000</span>
                </div>
                <textarea
                  ref={transfer.desktopTextareaRef}
                  value={transfer.textInput}
                  onChange={(event) => transfer.onTextInputChange(event.target.value)}
                  onKeyDown={(event) => handleTextSubmit(event, transfer.onSendText)}
                  placeholder="部署窗口改到下午 4 点，把新的环境变量同步一下。"
                  className="block min-h-[72px] w-full resize-none border-none bg-transparent px-3.5 py-3.5 text-[15px] leading-6 outline-none placeholder:text-[var(--text-muted)]"
                  rows={1}
                />
                <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5">
                  <div className="flex gap-1.5">
                    <PaperActionButton icon="pasteSend" label="粘贴并发送" onClick={transfer.onPasteAndSend} />
                    <PaperActionButton icon="fileUp" label="文件" onClick={() => transfer.fileInputRef.current?.click()} />
                    <PaperActionButton icon="folderUp" label="文件夹" onClick={() => transfer.folderInputRef.current?.click()} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[var(--text-muted)]">⏎ 发送</span>
                    <PaperActionButton primary icon="send" label="发送" onClick={transfer.onSendText} disabled={!transfer.textInput.trim()} />
                  </div>
                </div>
              </div>
            </div>
          </main>

          <aside className="overflow-y-auto border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] px-7 py-6">
            <SectionRule number="04" label="安全状态" />
            <div className="mb-5 rounded-[4px] border border-[var(--border-subtle)] border-l-[3px] border-l-[var(--status-online)] bg-[var(--bg-elevated)] p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[var(--status-online)]">
                  <DropIcons.shieldCheck size={18} />
                </span>
                <span className="text-[13px] font-semibold">
                  {session.hasPassword ? "密码房间已启用" : "本地加密已启用"}
                </span>
              </div>
              <div className="text-[11.5px] leading-6 text-[var(--text-secondary)]">
                文本和文件在本地加密后传输。房间链接包含访问密钥，请只分享给可信设备。
              </div>
            </div>

            <div className="mb-5 flex flex-col gap-2.5">
              <PaperFact label="房间类型" value={session.hasPassword ? "密码房间" : "标准"} />
              <PaperFact label="加密算法" value="AES-GCM · 客户端" mono />
              <PaperFact label="传输通道" value="WebSocket 中继" mono />
              <PaperFact label="历史持久化" value="浏览器本地" />
              <PaperFact label="文件上限" value="单项 ≤ 500 MB" mono />
            </div>

            <SectionRule number="05" label="偏好" />
            <div className="space-y-4">
              <PaperToggle
                label="自动复制收到的文本"
                sub="收到后自动进入剪贴板，其他应用可能读取。"
                enabled={security.autoCopyToClipboard}
                onToggle={security.onToggleAutoCopy}
              />
              <PaperToggle
                label="大文件二次确认"
                sub="移动端超过 100MB 时再次确认。"
                enabled={security.confirmLargeMobileTransfers}
                onToggle={security.onToggleConfirmLargeTransfers}
              />
              <PaperToggle
                label="深色模式"
                sub="切换 Paper dark tokens。"
                enabled={security.isDarkMode}
                onToggle={security.onToggleDarkMode}
              />
            </div>

            <div className="mt-6 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
              <div className="mb-2 text-[13px] font-semibold">密码房间</div>
              <div className="text-[11.5px] leading-6 text-[var(--text-secondary)]">
                额外密码不会出现在链接中，需要单独告知对方。
              </div>
              <div className="mt-3">
                <PaperActionButton
                  primary
                  icon="lock"
                  label={session.hasPassword ? "更新密码房间" : "设置密码房间"}
                  onClick={security.onOpenCreatePasswordModal}
                  block
                />
              </div>
            </div>

            <button
              type="button"
              onClick={ui.onOpenClearHistoryConfirm}
              className="mt-6 inline-flex items-center gap-2 text-[12px] font-medium text-[var(--status-danger)]"
            >
              <DropIcons.trash size={14} />
              清空本次会话历史
            </button>
          </aside>
        </div>
      </div>

      <div
        className="w-full max-w-full overflow-x-hidden lg:hidden"
        style={{ minHeight: ui.keyboardOpen ? ui.viewportHeight : undefined }}
      >
        <div className="mx-auto w-full max-w-[390px]">
          <div className="flex h-11 items-center justify-between px-4 text-[15px] font-semibold">
            <span>{currentTime}</span>
            <span className="w-7" />
            <span className="text-[13px] text-[var(--text-secondary)]">􀛨</span>
          </div>

          <header className="border-b-2 border-[var(--text-primary)] px-4 pb-4 pt-3">
            <div className="flex items-center gap-3">
              <DropLogo size={32} />
              <div className="min-w-0 flex-1">
                <div className="paper-mono text-[9.5px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  ROOM · {session.roomCode || "----"}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[15px] font-semibold">
                  <span
                    className={cn(
                      "h-[7px] w-[7px] rounded-full",
                      session.isConnected ? "bg-[var(--status-online)]" : "bg-[var(--status-offline)]",
                    )}
                  />
                  {session.isConnected ? `已连接 · ${Math.max(session.peersCount, 1)} 台设备` : "等待连接"}
                </div>
              </div>
              <button
                type="button"
                onClick={ui.onOpenConnectSheet}
                className="rounded-[8px] border border-[var(--border-medium)] bg-[var(--bg-surface)] p-2.5"
              >
                <DropIcons.qr size={20} />
              </button>
            </div>
          </header>

          <div className="w-full max-w-full space-y-4 px-4 pb-8 pt-5">
          {!ui.keyboardOpen ? (
            <>
              <button
                type="button"
                onClick={transfer.onPasteAndSend}
                className="flex w-full items-center gap-3.5 rounded-[10px] bg-[var(--action-primary)] px-5 py-4 text-left text-[var(--text-on-action)]"
              >
                <div className="rounded-[8px] bg-white/15 p-2.5">
                  <DropIcons.pasteSend size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] font-semibold">粘贴并发送</div>
                  <div className="mt-1 text-[12px] text-white/75">读取剪贴板文本并立即发出</div>
                </div>
                <span className="text-[20px]">→</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => transfer.fileInputRef.current?.click()}
                  className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-left"
                >
                  <span className="text-[var(--action-primary)]">
                    <DropIcons.fileUp size={22} />
                  </span>
                  <div className="mt-2 text-[14px] font-medium">选择文件</div>
                  <div className="mt-1 text-[11px] text-[var(--text-muted)]">多选 · ≤500MB</div>
                </button>
                <button
                  type="button"
                  onClick={() => transfer.folderInputRef.current?.click()}
                  className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-left"
                >
                  <span className="text-[var(--action-primary)]">
                    <DropIcons.folderUp size={22} />
                  </span>
                  <div className="mt-2 text-[14px] font-medium">发送文件夹</div>
                  <div className="mt-1 text-[11px] text-[var(--text-muted)]">压缩为 zip</div>
                </button>
              </div>
            </>
          ) : null}

          <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
            <div className="paper-mono mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">输入文字</div>
            <textarea
              ref={transfer.mobileTextareaRef}
              value={transfer.textInput}
              onChange={(event) => transfer.onTextInputChange(event.target.value)}
              onKeyDown={(event) => handleTextSubmit(event, transfer.onSendText)}
              placeholder="在此输入要发送的内容…"
              className="block min-h-[76px] w-full resize-none border-none bg-transparent text-[14px] leading-6 outline-none placeholder:text-[var(--text-muted)]"
              rows={3}
            />
            <div className="mt-3 flex flex-col gap-2">
              <span className="text-[11px] text-[var(--text-muted)]">{transfer.textInput.length} / 2000</span>
              <PaperActionButton primary block icon="send" label="发送" onClick={transfer.onSendText} disabled={!transfer.textInput.trim()} />
            </div>
          </div>

          {!ui.keyboardOpen ? (
            <>
              <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="paper-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">加入房间</div>
                  {join.isJoinRequestPending ? (
                    <span className="paper-mono text-[10px] text-[var(--security-password)]">{joinCountdown}s</span>
                  ) : null}
                </div>
                <div className="relative">
                  <div className="grid w-full grid-cols-4 gap-1.5">
                    {join.digitSlots.map((digit, index) => (
                      <button
                        key={`mobile-slot-${index}`}
                        type="button"
                        onClick={() => mobileJoinInputRef.current?.focus()}
                        className={cn(
                          "flex h-12 min-w-0 items-center justify-center rounded-[8px] border-[1.5px] bg-[var(--bg-elevated)] paper-mono text-[22px] font-semibold",
                          index === join.joinCodeInput.length && !join.isJoinRequestPending
                            ? "border-[var(--action-primary)] shadow-[0_0_0_3px_var(--focus-ring-muted)]"
                            : "border-[var(--border-medium)]",
                        )}
                      >
                        {digit || (index === join.joinCodeInput.length && !join.isJoinRequestPending ? <span className="h-5 w-[2px] bg-[var(--action-primary)]" /> : "")}
                      </button>
                    ))}
                  </div>
                  <input
                    ref={mobileJoinInputRef}
                    value={join.joinCodeInput}
                    onChange={(event) => join.onJoinCodeChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        join.onJoinByCode();
                      }
                    }}
                    className="absolute inset-0 opacity-0"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                  />
                </div>
                <div className="mt-3">
                  <PaperActionButton primary block icon="link" label={join.isJoinRequestPending ? "等待确认中" : "发起加入"} onClick={join.onJoinByCode} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="paper-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">最近记录</span>
                  <button
                    type="button"
                    onClick={ui.onOpenAllMessages}
                    className="text-[12px] font-medium text-[var(--action-primary)]"
                  >
                    查看全部 →
                  </button>
                </div>
                <div className="space-y-2">
                  {recentMessages.length > 0 ? (
                    recentMessages.map((message, index) => (
                      <MiniEntry
                        key={message.id}
                        message={message}
                        number={String(transfer.messages.length - index).padStart(3, "0")}
                        socketId={session.socketId}
                        formatFileSize={transfer.formatFileSize}
                      />
                    ))
                  ) : (
                    <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">
                      暂无传输记录
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
                <div className="paper-mono mb-3 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">偏好</div>
                <div className="space-y-3">
                  <CompactToggleRow
                    label="自动复制收到的文本"
                    enabled={security.autoCopyToClipboard}
                    onToggle={security.onToggleAutoCopy}
                  />
                  <CompactToggleRow
                    label="深色模式"
                    enabled={security.isDarkMode}
                    onToggle={security.onToggleDarkMode}
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <PaperActionButton icon="lock" label="密码房间" flex onClick={security.onOpenCreatePasswordModal} />
                  <PaperActionButton icon="trash" label="清空记录" flex onClick={ui.onOpenClearHistoryConfirm} />
                </div>
              </div>
            </>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function HiddenTransferInputs({
  fileInputRef,
  folderInputRef,
  onFileInput,
  onFolderInput,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onFileInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onFolderInput: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFileInput} />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        onChange={onFolderInput}
        /* @ts-expect-error webkitdirectory is not in DOM typings */
        webkitdirectory=""
        directory=""
      />
    </>
  );
}

function ToastBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed left-1/2 top-4 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-[10px] border border-[rgba(168,59,50,0.18)] bg-[var(--bg-elevated)] px-4 py-3 text-[13px] shadow-[var(--shadow-modal)]">
      <span className="text-[var(--status-danger)]">
        <DropIcons.alert size={16} />
      </span>
      <span>{message}</span>
      <button type="button" onClick={onClose} className="text-[var(--text-muted)]">
        <DropIcons.x size={14} />
      </button>
    </div>
  );
}

function ConnectSheet({
  roomCode,
  shareUrl,
  hasPassword,
  copiedId,
  onClose,
  onCopy,
}: {
  roomCode: string;
  shareUrl: string;
  hasPassword: boolean;
  copiedId: string | null;
  onClose: () => void;
  onCopy: (value: string, id: string) => void;
}) {
  return (
    <Overlay>
      <div className="w-full max-w-[440px] overflow-hidden rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[var(--shadow-modal)]">
        <div className="flex items-start justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <div className="paper-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Connect</div>
            <h3 className="mt-1 text-[18px] font-semibold">连接其他设备</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-[8px] bg-[var(--bg-hover)] p-2">
            <DropIcons.x size={16} />
          </button>
        </div>
        <div className="flex flex-col items-center px-6 py-6">
          <div className="rounded-[8px] border border-[var(--border-medium)] bg-[var(--bg-elevated)] p-2.5">
            <QRCodeSVG value={shareUrl} size={180} bgColor="transparent" fgColor="currentColor" />
          </div>
          <div className="mt-3 text-[12px] text-[var(--text-muted)]">用手机摄像头或其他设备扫码加入</div>

          <div className="my-5 flex w-full items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            <span className="paper-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">或</span>
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          </div>

          <div className="w-full space-y-3">
            <div>
              <div className="paper-mono mb-1.5 text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">分享链接</div>
              <button
                type="button"
                onClick={() => onCopy(shareUrl, "share-url-modal")}
                className="flex w-full items-center gap-2 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1 truncate paper-mono text-[12px] text-[var(--text-secondary)]">
                  {truncateMiddle(shareUrl, 32, 14)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-[6px] bg-[var(--action-primary)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--text-on-action)]">
                  <IconWrap icon={copiedId === "share-url-modal" ? "check" : "copy"} size={12} />
                  {copiedId === "share-url-modal" ? "已复制" : "复制"}
                </span>
              </button>
            </div>

            <div>
              <div className="paper-mono mb-1.5 text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">房间号</div>
              <button
                type="button"
                onClick={() => onCopy(roomCode, "room-code-modal")}
                className="flex w-full items-center justify-between rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-4 py-3.5 text-left"
              >
                <span className="paper-mono text-[28px] font-semibold tracking-[0.75rem] text-[var(--action-primary)]">
                  {(roomCode || "----").split("").join(" ")}
                </span>
                <IconWrap icon={copiedId === "room-code-modal" ? "check" : "copy"} size={16} />
              </button>
            </div>
          </div>

          <div className="mt-5 w-full rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-2.5 text-[11.5px] leading-6 text-[var(--text-secondary)]">
            房间链接包含访问密钥。用房间号加入时，当前设备需要确认请求。
            {hasPassword ? " 当前房间还启用了额外密码保护。" : ""}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function ApprovalDialog({
  requests,
  onApprove,
  onReject,
}: {
  requests: PendingRoomCodeJoinRequest[];
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}) {
  return (
    <Overlay>
      <div className="w-full max-w-[420px] rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[var(--shadow-modal)]">
        <div className="border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="paper-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Join approval</div>
          <div className="mt-1 text-[18px] font-semibold">加入确认</div>
        </div>
        <div className="space-y-3 px-5 py-5">
          {requests.map((request) => (
            <div key={request.requestId} className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <div className="text-[14px] font-semibold">{request.requesterLabel} 请求通过房间号加入</div>
              <div className="mt-2 text-[12.5px] leading-6 text-[var(--text-secondary)]">
                确认后该设备会获得当前房间的分享链接。
              </div>
              <div className="mt-4 flex gap-2">
                <PaperActionButton primary flex icon="check" label="允许" onClick={() => onApprove(request.requestId)} />
                <PaperActionButton flex icon="x" label="拒绝" onClick={() => onReject(request.requestId)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Overlay>
  );
}

function PasswordRoomDialog({
  mode,
  value,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: "create" | "join";
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const isCreate = mode === "create";

  return (
    <Overlay dismissible={isCreate} onDismiss={isCreate ? onClose : undefined}>
      <div className="w-full max-w-[420px] overflow-hidden rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[var(--shadow-modal)]">
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="rounded-[8px] bg-[rgba(180,116,42,0.12)] p-2 text-[var(--security-password)]">
            <DropIcons.lock size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="paper-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Password room</div>
            <div className="mt-1 text-[16px] font-semibold">{isCreate ? "设置房间密码" : "输入房间密码"}</div>
          </div>
          {isCreate ? (
            <button type="button" onClick={onClose} className="rounded-[8px] bg-[var(--bg-hover)] p-2">
              <DropIcons.x size={16} />
            </button>
          ) : null}
        </div>

        <div className="space-y-3 px-5 py-5">
          <div className="text-[12.5px] leading-6 text-[var(--text-secondary)]">
            {isCreate
              ? "密码会作为额外加密层，房间链接不会包含密码，你需要单独分享给对方。"
              : "该房间启用了密码保护。密码不在链接中，请从邀请方单独获取。"}
          </div>

          <div>
            <div className="paper-mono mb-1.5 text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">密码</div>
            <div className="flex items-center gap-2 rounded-[8px] border-[1.5px] border-[var(--action-primary)] bg-[var(--bg-inset)] px-3 py-2.5 shadow-[0_0_0_3px_var(--focus-ring-muted)]">
              <input
                type="password"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
                placeholder={isCreate ? "例如 summit-field-43" : "输入房间密码"}
                autoFocus
                className="min-w-0 flex-1 border-none bg-transparent paper-mono text-[15px] tracking-[0.18em] outline-none placeholder:tracking-normal placeholder:text-[var(--text-muted)]"
              />
              <span className="text-[var(--text-secondary)]">
                <DropIcons.eye size={16} />
              </span>
            </div>
          </div>

          {isCreate ? <div className="text-[11.5px] text-[var(--text-muted)]">建议使用 3 个以上词组，并分两条渠道发送链接和密码。</div> : null}

          <div className="flex gap-2 pt-1">
            {isCreate ? <PaperActionButton flex label="取消" onClick={onClose} /> : null}
            <PaperActionButton primary flex label={isCreate ? "创建房间" : "加入"} onClick={onSubmit} />
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Overlay dismissible onDismiss={onCancel}>
      <div className="w-full max-w-[380px] rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-modal)]">
        <div className="text-[17px] font-semibold">{title}</div>
        <div className="mt-2 text-[12.5px] leading-6 text-[var(--text-secondary)]">{description}</div>
        <div className="mt-5 flex gap-2">
          <PaperActionButton flex label="取消" onClick={onCancel} />
          <PaperActionButton
            primary
            flex
            label={confirmLabel}
            onClick={onConfirm}
            className={danger ? "bg-[var(--status-danger)] border-[var(--status-danger)] text-white hover:bg-[var(--status-danger)]" : undefined}
          />
        </div>
      </div>
    </Overlay>
  );
}

function TransferDialog({
  progress,
  isZipping,
  formatFileSize,
}: {
  progress: UploadProgress | null;
  isZipping: boolean;
  formatFileSize: (bytes: number) => string;
}) {
  return (
    <Overlay>
      <div className="w-full max-w-[320px] rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-6 text-center shadow-[var(--shadow-modal)]">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--action-primary)] border-t-transparent" />
        <div className="mt-4 text-[15px] font-semibold">{isZipping ? "压缩中..." : "加密发送中..."}</div>
        <div className="mt-1 text-[12px] text-[var(--text-muted)]">{progress?.fileName || "准备中..."}</div>
        {progress ? (
          <>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--bg-inset)]">
              <div
                className="h-full rounded-full bg-[var(--action-primary)] transition-[width]"
                style={{ width: `${Math.min((progress.current / progress.total) * 100, 100)}%` }}
              />
            </div>
            <div className="mt-2 text-[12px] text-[var(--text-muted)]">
              {isZipping
                ? `${Math.round(progress.current)}%`
                : `${formatFileSize(progress.current)} / ${formatFileSize(progress.total)}`}
            </div>
          </>
        ) : null}
      </div>
    </Overlay>
  );
}

function AllMessagesSheet({
  items,
  socketId,
  copiedId,
  formatFileSize,
  onClose,
  onCopy,
  onDownload,
}: {
  items: TimelineItem[];
  socketId?: string;
  copiedId: string | null;
  formatFileSize: (bytes: number) => string;
  onClose: () => void;
  onCopy: (text: string, id: string) => void;
  onDownload: (fileData: ArrayBuffer, fileName: string, fileType: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[75] bg-[var(--bg-canvas)] px-5 pb-6 pt-4 lg:hidden">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <div>
          <div className="paper-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Transfer log</div>
          <div className="mt-1 text-[18px] font-semibold">全部记录</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-[8px] bg-[var(--bg-surface)] p-2">
          <DropIcons.x size={18} />
        </button>
      </div>
      <div className="mt-4 h-[calc(100dvh-7rem)] overflow-y-auto">
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item, index) => (
              <TimelineEntry
                key={item.kind === "message" ? item.message.id : `mobile-progress-${item.progress.fileName}`}
                item={item}
                number={String(index + 1).padStart(3, "0")}
                socketId={socketId}
                copiedId={copiedId}
                formatFileSize={formatFileSize}
                onCopy={onCopy}
                onDownload={onDownload}
                compact
              />
            ))}
          </div>
        ) : (
          <EmptyLogState filter="all" />
        )}
      </div>
    </div>
  );
}

function SectionRule({ number, label }: { number: string; label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5 border-b border-[var(--border-subtle)] pb-1.5">
      <span className="paper-mono rounded-[2px] border border-[var(--border-medium)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {number}
      </span>
      <span className="text-[13px] font-semibold">{label}</span>
    </div>
  );
}

function StampField({
  label,
  value,
  mono,
  big,
  dot,
}: {
  label: string;
  value: string;
  mono?: boolean;
  big?: boolean;
  dot?: boolean;
}) {
  return (
    <div>
      <div className="paper-mono mb-0.5 text-[9px] uppercase tracking-[0.15em] text-[var(--text-muted)]">{label}</div>
      <div className={cn("flex items-center gap-1.5 font-semibold", mono ? "paper-mono" : "", big ? "text-[22px]" : "text-[14px]")}>
        {dot ? <span className="h-[7px] w-[7px] rounded-full bg-[var(--status-online)]" /> : null}
        <span className={cn(mono && big ? "tracking-[0.2em]" : "")}>{value}</span>
      </div>
    </div>
  );
}

function PaperActionButton({
  label,
  icon,
  primary,
  flex,
  block,
  disabled,
  onClick,
  className,
}: {
  label: string;
  icon?: DropIconName;
  primary?: boolean;
  flex?: boolean;
  block?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[6px] border px-3 py-2 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        primary
          ? "border-[var(--action-primary)] bg-[var(--action-primary)] text-[var(--text-on-action)] hover:bg-[var(--action-primary-hover)]"
          : "border-[var(--border-medium)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
        flex ? "flex-1" : "",
        block ? "w-full" : "",
        className,
      )}
    >
      {icon ? <IconWrap icon={icon} size={14} /> : null}
      {label}
    </button>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active ? { color: "#fbf8f2" } : undefined}
      className={cn(
        "min-w-[3.5rem] rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "bg-[var(--text-primary)] text-white"
          : "border border-[var(--border-medium)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
      )}
    >
      {label}
    </button>
  );
}

function DeviceRow({
  id,
  name,
  tag,
  self,
}: {
  id: string;
  name: string;
  tag: string;
  self?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5 rounded-[6px] border border-[var(--border-subtle)] p-2.5", self ? "bg-[var(--bg-inset)]" : "bg-[var(--bg-elevated)]")}>
      <div className="rounded-[4px] bg-[var(--bg-canvas)] p-2 text-[var(--action-primary)]">
        <DropIcons.device size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium">{name}</span>
          {self ? <span className="rounded-[2px] bg-[var(--action-primary)] px-1.5 py-0.5 paper-mono text-[10px] text-[var(--text-on-action)]">THIS</span> : null}
        </div>
        <div className="paper-mono mt-0.5 text-[11px] text-[var(--text-muted)]">{tag}</div>
      </div>
      <span className="h-2 w-2 rounded-full bg-[var(--status-online)]" />
    </div>
  );
}

function DigitSlotsInput({
  value,
  digits,
  onChange,
  onSubmit,
  pending,
}: {
  value: string;
  digits: string[];
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="relative">
        <div className="grid grid-cols-4 gap-2">
          {digits.map((digit, index) => {
            const focused = !pending && index === value.length;
            return (
              <button
                key={`join-slot-${index}`}
                type="button"
                onClick={() => inputRef.current?.focus()}
                className={cn(
                  "flex h-[52px] min-w-0 items-center justify-center rounded-[6px] border-[1.5px] bg-[var(--bg-elevated)] paper-mono text-[24px] font-semibold",
                  focused ? "border-[var(--action-primary)] shadow-[0_0_0_3px_var(--focus-ring-muted)]" : "border-[var(--border-medium)]",
                )}
              >
                {digit || (focused ? <span className="h-[18px] w-[2px] bg-[var(--action-primary)]" /> : "")}
              </button>
            );
          })}
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit();
            }
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          className="absolute inset-0 opacity-0"
        />
      </div>
      <div className="mt-3">
        <PaperActionButton primary block icon="link" label={pending ? "等待确认中" : "发起加入"} onClick={onSubmit} />
      </div>
    </>
  );
}

function PaperFact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-[var(--border-subtle)] py-1.5 text-[12px]">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={cn("font-medium text-[var(--text-primary)]", mono ? "paper-mono" : "")}>{value}</span>
    </div>
  );
}

function PaperToggle({
  label,
  sub,
  enabled,
  onToggle,
}: {
  label: string;
  sub: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-start gap-2.5 text-left">
      <span
        className={cn(
          "mt-0.5 flex h-5 w-8 rounded-full p-0.5 transition-colors",
          enabled ? "justify-end bg-[var(--action-primary)]" : "justify-start bg-[var(--border-medium)]",
        )}
      >
        <span className="h-4 w-4 rounded-full bg-[var(--bg-elevated)]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{label}</span>
        <span className="mt-1 block text-[11.5px] leading-6 text-[var(--text-muted)]">{sub}</span>
      </span>
    </button>
  );
}

function CompactToggleRow({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left">
      <span className="text-[13px]">{label}</span>
      <span
        className={cn(
          "flex h-5 w-8 rounded-full p-0.5 transition-colors",
          enabled ? "justify-end bg-[var(--action-primary)]" : "justify-start bg-[var(--border-medium)]",
        )}
      >
        <span className="h-4 w-4 rounded-full bg-[var(--bg-elevated)]" />
      </span>
    </button>
  );
}

function TimelineEntry({
  item,
  number,
  socketId,
  copiedId,
  formatFileSize,
  onCopy,
  onDownload,
  compact,
}: {
  item: TimelineItem;
  number: string;
  socketId?: string;
  copiedId: string | null;
  formatFileSize: (bytes: number) => string;
  onCopy: (text: string, id: string) => void;
  onDownload: (fileData: ArrayBuffer, fileName: string, fileType: string) => void;
  compact?: boolean;
}) {
  if (item.kind === "progress") {
    return (
      <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3">
        <TimelineMeta number={number} time={formatTimeStamp(new Date())} compact={compact} />
        <div className="rounded-[6px] border border-[var(--border-subtle)] border-l-[3px] border-l-[var(--action-primary)] bg-[var(--bg-surface)] px-4 py-3">
          <div className="mb-3 flex items-center justify-between text-[11px] font-semibold">
            <span>→ 此设备</span>
            <span className="paper-mono uppercase tracking-[0.08em] text-[var(--text-muted)]">FILE</span>
          </div>
          <div className="flex items-center gap-3">
            <PaperFileThumb extension={getFileExtension(item.progress.fileName)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate font-medium">{item.progress.fileName}</span>
                <span className="paper-mono text-[11px] text-[var(--text-muted)]">
                  {item.isZipping
                    ? `${Math.round(item.progress.current)}%`
                    : `${formatFileSize(item.progress.current)} / ${formatFileSize(item.progress.total)}`}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-inset)]">
                <div
                  className="h-full bg-[var(--transfer-progress)] transition-[width]"
                  style={{ width: `${Math.min((item.progress.current / item.progress.total) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { message } = item;
  const isOwn = isOwnMessage(message.senderId, socketId);
  const contentKind = message.type === "text" ? (looksLikeMarkdown(message.content || "") ? "MARKDOWN" : "TEXT") : "FILE";

  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-[40px_minmax(0,1fr)]" : "grid-cols-[52px_minmax(0,1fr)]")}>
      <TimelineMeta number={number} time={formatTimeStamp(new Date(message.timestamp))} compact={compact} />
      <div
        className={cn(
          "rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3",
          isOwn ? "border-l-[3px] border-l-[var(--action-primary)]" : "border-l-[3px] border-l-[var(--transfer-accent)]",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold">{isOwn ? "→ 此设备" : `← ${renderSenderLabel(message.senderId)}`}</span>
          <span className="paper-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{contentKind}</span>
        </div>

        {message.type === "text" ? (
          <>
            {looksLikeMarkdown(message.content || "") ? (
              <div className="paper-markdown prose prose-sm max-w-none text-[var(--text-primary)] prose-headings:my-2 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-pre:my-2 prose-pre:rounded-[4px] prose-pre:bg-[var(--bg-inset)] prose-pre:p-3 prose-code:rounded-[4px] prose-code:bg-[var(--bg-inset)] prose-code:px-1 prose-code:py-0.5 prose-code:text-[var(--text-primary)]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ""}</ReactMarkdown>
              </div>
            ) : (
              <div className="whitespace-pre-wrap break-words text-[14px] leading-6">{message.content}</div>
            )}
            {message.content ? (
              <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[var(--text-muted)]">
                <span>{message.content.length} 字</span>
                <button
                  type="button"
                  onClick={() => onCopy(message.content || "", message.id)}
                  className="inline-flex items-center gap-1 text-[var(--action-primary)]"
                >
                  <IconWrap icon={copiedId === message.id ? "check" : "copy"} size={12} />
                  {copiedId === message.id ? "已复制" : "复制"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex items-center gap-3">
            <PaperFileThumb extension={getFileExtension(message.fileName)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-[13px] font-medium">{message.fileName}</span>
                <span className="paper-mono text-[11px] text-[var(--text-muted)]">
                  {message.fileSize ? formatFileSize(message.fileSize) : "未知"}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px]">
                {message.fileData ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-[var(--status-online)]">
                      <DropIcons.check size={12} />
                      已送达
                    </span>
                    <span className="text-[var(--text-muted)]">·</span>
                    <button
                      type="button"
                      onClick={() => onDownload(message.fileData!, message.fileName || "download", message.fileType || "application/octet-stream")}
                      className="inline-flex items-center gap-1 text-[var(--action-primary)]"
                    >
                      <DropIcons.download size={12} />
                      下载
                    </button>
                  </>
                ) : (
                  <span className="text-[var(--text-muted)]">
                    {isOwn ? "发送记录 · 当前会话不保留二进制副本" : "历史条目 · 二进制内容仅本会话可下载"}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineMeta({ number, time, compact }: { number: string; time: string; compact?: boolean }) {
  return (
    <div className="flex flex-col items-end pt-2">
      <span className={cn("paper-mono font-semibold text-[var(--text-muted)]", compact ? "text-[10px]" : "text-[11px]")}>№ {number}</span>
      <span className="paper-mono mt-1 text-[10px] text-[var(--text-muted)]">{time}</span>
    </div>
  );
}

function EmptyLogState({ filter }: { filter: MessageFilter }) {
  const label = filter === "all" ? "等待接收消息..." : "当前筛选下暂无内容";
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-[var(--border-medium)] bg-[var(--bg-surface)]">
      <span className="text-[var(--text-muted)]">
        <DropIcons.shieldCheck size={32} />
      </span>
      <div className="text-[14px] text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

function MiniEntry({
  message,
  number,
  socketId,
  formatFileSize,
}: {
  message: Message;
  number: string;
  socketId?: string;
  formatFileSize: (bytes: number) => string;
}) {
  const isOwn = isOwnMessage(message.senderId, socketId);

  return (
    <div className="rounded-[8px] border border-[var(--border-subtle)] border-l-[3px] border-l-[var(--transfer-accent)] bg-[var(--bg-surface)] p-3">
      <div className="mb-2 flex items-center justify-between paper-mono text-[10px] text-[var(--text-muted)]">
        <span>№ {number}</span>
        <span>{formatTimeStamp(new Date(message.timestamp))}</span>
      </div>
      {message.type === "text" ? (
        <div className="text-[14px] leading-6 text-[var(--text-primary)]">
          {(message.content || "").slice(0, 120)}
          {(message.content || "").length > 120 ? "…" : ""}
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          <PaperFileThumb extension={getFileExtension(message.fileName)} small />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{message.fileName}</div>
            <div className="mt-1 text-[11px] text-[var(--text-muted)]">
              {message.fileSize ? formatFileSize(message.fileSize) : "未知"} · {isOwn ? "已发送" : "已收到"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaperFileThumb({ extension, small }: { extension: string; small?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[8px] bg-[var(--bg-inset)] text-[var(--action-primary)]",
        small ? "h-[30px] w-[30px]" : "h-10 w-10",
      )}
    >
      <span className={cn("paper-mono font-semibold uppercase", small ? "text-[10px]" : "text-[11px]")}>
        {extension}
      </span>
    </div>
  );
}

function IconWrap({ icon, size }: { icon: DropIconName; size?: number }) {
  const Icon = DropIcons[icon];
  return <Icon size={size ?? 16} />;
}

function Overlay({
  children,
  dismissible,
  onDismiss,
}: {
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[2px]"
      onClick={dismissible ? onDismiss : undefined}
    >
      <div onClick={(event) => event.stopPropagation()}>{children}</div>
    </div>
  );
}

function handleTextSubmit(event: KeyboardEvent<HTMLTextAreaElement>, onSendText: () => void) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    onSendText();
  }
}

function buildDeviceRows(peersCount: number) {
  const totalDevices = Math.max(peersCount, 1);
  const peerCount = Math.max(totalDevices - 1, 0);

  return [
    {
      id: "self",
      name: detectCurrentDeviceName(),
      tag: "此设备 · 当前会话",
      self: true,
    },
    ...Array.from({ length: peerCount }, (_, index) => ({
      id: `peer-${index + 1}`,
      name: `已连接设备 ${index + 1}`,
      tag: "通过当前房间加入",
    })),
  ];
}

function detectCurrentDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  return "当前设备";
}

function isOwnMessage(senderId: string, socketId?: string) {
  return senderId === socketId || senderId === "me";
}

function renderSenderLabel(senderId: string) {
  if (!senderId || senderId === "me") {
    return "对方设备";
  }

  return `设备 ${senderId.slice(0, 6)}`;
}

function formatDateStamp(date: Date) {
  return new Intl.DateTimeFormat("sv-SE").format(date);
}

function formatTimeStamp(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function truncateMiddle(value: string, start: number, end: number) {
  if (value.length <= start + end + 1) {
    return value;
  }

  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function getFileExtension(fileName?: string) {
  if (!fileName || !fileName.includes(".")) {
    return "file";
  }

  return fileName.split(".").pop()?.slice(0, 4).toLowerCase() || "file";
}
