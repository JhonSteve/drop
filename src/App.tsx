import { useEffect, useState } from "react";

import { PaperWorkspace, type MessageFilter } from "./components/paper/PaperWorkspace";
import { useDropSession } from "./hooks/useDropSession";
import { useJoinByCode } from "./hooks/useJoinByCode";
import { useRoomSecurity } from "./hooks/useRoomSecurity";
import { useTransferTimeline } from "./hooks/useTransferTimeline";
import { useViewportComposer } from "./hooks/useViewportComposer";

const THEME_STORAGE_KEY = "drop-paper-theme";
const LARGE_TRANSFER_CONFIRM_KEY = "drop-confirm-large-mobile-transfers";

export default function App() {
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [showConnectSheet, setShowConnectSheet] = useState(false);
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [showCreatePasswordModal, setShowCreatePasswordModal] = useState(false);
  const [createPasswordDraft, setCreatePasswordDraft] = useState("");
  const [messageFilter, setMessageFilter] = useState<MessageFilter>("all");
  const [isDarkMode, setIsDarkMode] = useState(() => readStoredBoolean(THEME_STORAGE_KEY, window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false));
  const [confirmLargeMobileTransfers, setConfirmLargeMobileTransfers] = useState(() => readStoredBoolean(LARGE_TRANSFER_CONFIRM_KEY, true));

  const security = useRoomSecurity();

  const session = useDropSession({
    onRequirePasswordChange: security.setNeedsPassword,
    onHasPasswordChange: security.setHasPassword,
    onErrorToast: setErrorToast,
  });

  const join = useJoinByCode({
    socket: session.socket,
    isConnected: session.isConnected,
    isJoinRequestPending: session.isJoinRequestPending,
    onErrorToast: setErrorToast,
    onApproveJoinRequest: session.approveJoinRequest,
    onRejectJoinRequest: session.rejectJoinRequest,
  });

  const transfer = useTransferTimeline({
    socket: session.socket,
    cryptoKey: session.cryptoKey,
    roomId: session.roomId,
    autoCopyRef: security.autoCopyRef,
    confirmLargeMobileTransfers,
    onErrorToast: setErrorToast,
  });

  const viewport = useViewportComposer(transfer.textInput);

  useEffect(() => {
    if (!errorToast) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setErrorToast(null);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [errorToast]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    document.documentElement.classList.toggle("light", !isDarkMode);
    document.documentElement.style.colorScheme = isDarkMode ? "dark" : "light";
    const themeColor = isDarkMode ? "#131210" : "#F5F1EA";
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute("content", themeColor);
    });
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    window.localStorage.setItem(LARGE_TRANSFER_CONFIRM_KEY, JSON.stringify(confirmLargeMobileTransfers));
  }, [confirmLargeMobileTransfers]);

  const supportsCrypto = Boolean(window.crypto && window.crypto.subtle);

  const handleSubmitPassword = () => {
    void security.submitPassword({
      onSuccess: session.applyPasswordRoom,
      onError: setErrorToast,
    });
  };

  const handleCreatePasswordRoom = () => {
    void security.createPasswordRoom({
      password: createPasswordDraft,
      onSuccess: async (roomKey, key) => {
        transfer.setMessages([]);
        await session.applyPasswordRoom(roomKey, key);
        setCreatePasswordDraft("");
        setShowCreatePasswordModal(false);
        setShowConnectSheet(true);
      },
      onError: setErrorToast,
    });
  };

  if (!supportsCrypto) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--bg-canvas)] px-6 text-center text-[var(--text-primary)]">
        <div className="mb-4 text-[var(--status-danger)]">
          安全环境受限
        </div>
        <p className="max-w-md text-[14px] leading-7 text-[var(--text-secondary)]">
          端到端加密需要 HTTPS 和 Web Crypto 支持。请在现代浏览器或本地 HTTPS 环境中重新打开 Drop。
        </p>
      </div>
    );
  }

  return (
    <PaperWorkspace
      session={{
        socketId: session.socket?.id,
        roomCode: session.roomCode,
        shareUrl: window.location.href,
        isConnected: session.isConnected,
        peersCount: session.peersCount,
        hasPassword: security.hasPassword,
        joinRequestExpiresAt: session.joinRequestExpiresAt,
        incomingJoinRequests: session.incomingJoinRequests,
      }}
      security={{
        needsPassword: security.needsPassword,
        passwordInput: security.passwordInput,
        autoCopyToClipboard: security.autoCopyToClipboard,
        confirmLargeMobileTransfers,
        isDarkMode,
        createPasswordDraft,
        showCreatePasswordModal,
        onPasswordInputChange: security.setPasswordInput,
        onSubmitPassword: handleSubmitPassword,
        onToggleAutoCopy: () => security.setAutoCopyToClipboard((value) => !value),
        onToggleConfirmLargeTransfers: () => setConfirmLargeMobileTransfers((value) => !value),
        onToggleDarkMode: () => setIsDarkMode((value) => !value),
        onOpenCreatePasswordModal: () => setShowCreatePasswordModal(true),
        onCloseCreatePasswordModal: () => {
          setShowCreatePasswordModal(false);
          setCreatePasswordDraft("");
        },
        onCreatePasswordDraftChange: setCreatePasswordDraft,
        onCreatePasswordRoom: handleCreatePasswordRoom,
      }}
      join={{
        joinCodeInput: join.joinCodeInput,
        digitSlots: join.digitSlots,
        isJoinRequestPending: session.isJoinRequestPending,
        onJoinCodeChange: join.setJoinCodeInput,
        onJoinByCode: join.handleJoinByCode,
        onApproveJoinRequest: join.handleApproveJoinRequest,
        onRejectJoinRequest: join.handleRejectJoinRequest,
      }}
      transfer={{
        messages: transfer.messages,
        textInput: transfer.textInput,
        copiedId: transfer.copiedId,
        isSending: transfer.isSending,
        isZipping: transfer.isZipping,
        uploadProgress: transfer.uploadProgress,
        pendingLargeTransfer: transfer.pendingLargeTransfer,
        fileInputRef: transfer.fileInputRef,
        folderInputRef: transfer.folderInputRef,
        desktopTextareaRef: viewport.desktopTextareaRef,
        mobileTextareaRef: viewport.mobileTextareaRef,
        onTextInputChange: transfer.setTextInput,
        onSendText: () => {
          void transfer.handleSendText();
        },
        onFileInput: transfer.handleFileInput,
        onFolderInput: transfer.handleFolderInput,
        onCopy: transfer.copyToClipboard,
        onPasteAndSend: () => {
          void transfer.pasteAndSend();
        },
        onDownload: transfer.downloadFile,
        onClearMessages: transfer.clearMessages,
        onConfirmPendingLargeTransfer: transfer.confirmPendingLargeTransfer,
        onCancelPendingLargeTransfer: transfer.cancelPendingLargeTransfer,
        formatFileSize: transfer.formatFileSize,
      }}
      ui={{
        errorToast,
        keyboardOpen: viewport.keyboardOpen,
        viewportHeight: viewport.viewportHeight,
        showConnectSheet,
        showAllMessages,
        showClearHistoryConfirm,
        messageFilter,
        onDismissToast: () => setErrorToast(null),
        onOpenConnectSheet: () => setShowConnectSheet(true),
        onCloseConnectSheet: () => setShowConnectSheet(false),
        onOpenAllMessages: () => setShowAllMessages(true),
        onCloseAllMessages: () => setShowAllMessages(false),
        onOpenClearHistoryConfirm: () => setShowClearHistoryConfirm(true),
        onCloseClearHistoryConfirm: () => setShowClearHistoryConfirm(false),
        onMessageFilterChange: setMessageFilter,
      }}
    />
  );
}

function readStoredBoolean(key: string, fallback: boolean) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
