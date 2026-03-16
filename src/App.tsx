import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import { Copy, FileUp, Send, Check, ShieldCheck, Download, Trash2, Wifi, WifiOff, ClipboardPaste, X, QrCode, ChevronRight } from "lucide-react";
import {
  encryptPayload,
  decryptPayload,
  generateRoomKey,
  deriveKey,
  deriveRoomId,
  base64ToArrayBuffer,
  type MessageType,
  type EncryptedEnvelope,
} from "./lib/crypto";
import type { WorkerResponse } from "./lib/file-worker";
import { cn } from "./lib/utils";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB (matches server maxHttpBufferSize)

interface Message {
  id: string;
  type: MessageType;
  senderId: string;
  timestamp: number;
  content?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  fileData?: ArrayBuffer;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState<string>("");
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [peersCount, setPeersCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [autoCopyToClipboard, setAutoCopyToClipboard] = useState(false);
  const autoCopyRef = useRef(true);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  useEffect(() => {
    if (!errorToast) return;
    const timer = setTimeout(() => setErrorToast(null), 4000);
    return () => clearTimeout(timer);
  }, [errorToast]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    autoCopyRef.current = autoCopyToClipboard;
  }, [autoCopyToClipboard]);

  // Initialize Web Worker for offloading file encryption
  useEffect(() => {
    workerRef.current = new Worker(
      new URL("./lib/file-worker.ts", import.meta.url),
      { type: "module" }
    );
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const initRoom = async () => {
      let hash = window.location.hash.slice(1);
      if (!hash) {
        hash = generateRoomKey();
        window.history.replaceState(null, "", `#${hash}`);
      }
      const key = await deriveKey(hash);
      setCryptoKey(key);
      const id = await deriveRoomId(hash);
      setRoomId(id);
    };
    initRoom();
    const onHashChange = () => window.location.reload();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // 从 localStorage 读取历史消息
  useEffect(() => {
    if (roomId) {
      const storageKey = `openclaw-messages-${roomId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Array<{
            id: string;
            type: MessageType;
            senderId: string;
            timestamp: number;
            content?: string;
            fileName?: string;
            fileType?: string;
            fileSize?: number;
          }>;
          // File data is not persisted (too large, ephemeral across sessions)
          const restored: Message[] = parsed.map(msg => ({
            ...msg,
            fileData: undefined,
          }));
          setMessages(restored);
        } catch (e) {
          console.error('Failed to parse saved messages', e);
        }
      }
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !cryptoKey) return;
    const newSocket = io(window.location.origin);
    setSocket(newSocket);
    newSocket.on("connect", () => {
      setIsConnected(true);
      newSocket.emit("join-room", roomId);
    });
    newSocket.on("disconnect", () => {
      setIsConnected(false);
      setPeersCount(0);
    });
    newSocket.on("room-count", (count: number) => setPeersCount(count));
    newSocket.on("receive-message", async (data: { senderId: string; payload: EncryptedEnvelope; timestamp: number }) => {
      try {
        const { senderId, payload, timestamp } = data;
        const decrypted = await decryptPayload(cryptoKey, payload);
        const newMessage: Message = { id: `${senderId}-${timestamp}`, type: decrypted.type, senderId, timestamp };
        if (decrypted.type === "text") {
          newMessage.content = decrypted.text;
          if (autoCopyRef.current && decrypted.text) {
            navigator.clipboard.writeText(decrypted.text).catch(() => {});
          }
        } else if (decrypted.type === "file") {
          const fileBuffer = base64ToArrayBuffer(decrypted.fileData!);
          newMessage.fileName = decrypted.fileName;
          newMessage.fileType = decrypted.fileType;
          newMessage.fileData = fileBuffer;
          newMessage.fileSize = fileBuffer.byteLength;
        }
        setMessages((prev) => [...prev, newMessage]);
      } catch (err) {
        console.error("Failed to decrypt message", err);
      }
    });
    return () => newSocket.disconnect();
  }, [roomId, cryptoKey]);

  // 保存消息到 localStorage
  useEffect(() => {
    if (!roomId) return;
    const storageKey = `openclaw-messages-${roomId}`;
    // Don't save fileData to localStorage — it's too large and ephemeral
    // (crypto key changes each session, so persisted file data is unrecoverable)
    const toSave = messages.map(({ fileData: _fileData, ...rest }) => ({
      ...rest,
      fileData: undefined,
    }));
    localStorage.setItem(storageKey, JSON.stringify(toSave));
  }, [messages, roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "44px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
  }, [textInput]);

  // Keyboard detection for mobile PWA
  useEffect(() => {
    const handleResize = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const fullHeight = window.innerHeight;
      const diff = fullHeight - currentHeight;
      
      if (diff > 150) {
        setKeyboardOpen(true);
        setViewportHeight(currentHeight);
      } else {
        setKeyboardOpen(false);
        setViewportHeight(fullHeight);
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleSendText = useCallback(async (text?: string) => {
    const contentToSend = text ?? textInput;
    if (!contentToSend.trim() || !socket || !cryptoKey || !roomId) return;
    try {
      const envelope = await encryptPayload(cryptoKey, { type: "text", text: contentToSend });
      socket.emit("send-message", { roomId, payload: envelope });
      setMessages((prev) => [...prev, { id: `me-${Date.now()}`, type: "text", senderId: socket.id || "me", timestamp: Date.now(), content: contentToSend }]);
      setTextInput("");
    } catch (err) {
      console.error("Failed to send text", err);
    }
  }, [textInput, socket, cryptoKey, roomId]);

  const sendFile = useCallback(
    (file: File) => {
      if (!socket || !cryptoKey || !roomId || !workerRef.current) return;
      setIsSending(true);

      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const handler = (e: MessageEvent<WorkerResponse>) => {
        const data = e.data;
        if (data.id !== requestId) return;
        workerRef.current?.removeEventListener("message", handler);

        if (data.type === "encrypt-file-error") {
          console.error("Failed to send file:", data.error);
          setIsSending(false);
          return;
        }

        // Send encrypted envelope via socket
        socket.emit("send-message", { roomId, payload: data.envelope });

        // Add to local messages with the ArrayBuffer for display/download
        setMessages((prev) => [
          ...prev,
          {
            id: `me-${Date.now()}`,
            type: "file" as MessageType,
            senderId: socket.id || "me",
            timestamp: Date.now(),
            fileName: data.fileName,
            fileType: data.fileType,
            fileData: data.fileData,
            fileSize: data.fileData.byteLength,
          },
        ]);

        setIsSending(false);
      };

      workerRef.current.addEventListener("message", handler);

      // Read file as ArrayBuffer and transfer it to the worker
      file.arrayBuffer().then((arrayBuffer) => {
        workerRef.current?.postMessage(
          {
            type: "encrypt-file",
            id: requestId,
            key: cryptoKey,
            fileName: file.name,
            fileType: file.type,
            fileData: arrayBuffer,
          },
          [arrayBuffer] // Transfer ownership to worker (zero-copy)
        );
      });
    },
    [socket, cryptoKey, roomId]
  );

  const handleFileInput = useCallback(
    (e: { target: { files: FileList | null } }) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > MAX_FILE_SIZE) {
        setErrorToast(`文件 "${file.name}" (${formatFileSize(file.size)}) 超过 ${formatFileSize(MAX_FILE_SIZE)} 上限`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      sendFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [sendFile]
  );

  const copyToClipboard = useCallback(async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  }, []);

  const pasteAndSend = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) await handleSendText(text);
    } catch (err) {
      console.error("Failed to read clipboard", err);
    }
  }, [handleSendText]);

  const downloadFile = useCallback((fileData: ArrayBuffer, fileName: string, fileType: string) => {
    const blob = new Blob([fileData], { type: fileType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    if (roomId) {
      const storageKey = `openclaw-messages-${roomId}`;
      localStorage.removeItem(storageKey);
    }
  }, [roomId]);
  const shareUrl = window.location.href;
  const recentMessages = messages.slice(-3);

  const renderMessage = (msg: Message) => {
    const isMe = msg.senderId === socket?.id || msg.senderId === "me";
    return (
      <div key={msg.id} className={cn("flex flex-col max-w-[88%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
        <div className="text-[10px] text-zinc-400 mb-1 px-1">{new Date(msg.timestamp).toLocaleTimeString()}</div>
        {msg.type === "text" ? (
          <div className={cn("px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words max-w-full", isMe ? "bg-emerald-600 text-white rounded-tr-md" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-tl-md")}>
            {msg.content}
            <button onClick={() => copyToClipboard(msg.content || "", msg.id)} className="ml-1.5 inline-flex opacity-60 hover:opacity-100">{copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}</button>
          </div>
        ) : (
          <div className={cn("p-2 rounded-2xl flex items-center gap-2 max-w-full", isMe ? "bg-emerald-100 dark:bg-emerald-600/30 border border-emerald-300 dark:border-emerald-500/40 rounded-tr-md" : "bg-zinc-200 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-tl-md")}>
            <div className={cn("p-1.5 rounded-lg shrink-0", isMe ? "bg-emerald-200 dark:bg-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "bg-zinc-300 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300")}><FileUp className="w-4 h-4" /></div>
            <div className="flex flex-col min-w-0 flex-1"><span className="text-xs font-medium truncate">{msg.fileName}</span><span className="text-[10px] text-zinc-500">{msg.fileSize ? formatFileSize(msg.fileSize) : "未知"}</span></div>
            <button onClick={() => msg.fileData && downloadFile(msg.fileData, msg.fileName!, msg.fileType || "")} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg shrink-0"><Download className="w-4 h-4" /></button>
          </div>
        )}
      </div>
    );
  };

  if (!window.crypto || !window.crypto.subtle) {
    return (
      <div className="h-[100dvh] bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
        <ShieldCheck className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-red-500 mb-2">安全环境受限</h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-md text-sm">端到端加密需要 HTTPS 环境。请在 Mac 上访问并扫码连接。</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans flex flex-col overflow-hidden">
      {errorToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-red-500 text-white px-4 py-3 rounded-xl shadow-lg text-sm max-w-[90vw]">
          {errorToast}
        </div>
      )}

      {isSending && (
        <div className="fixed inset-0 z-50 bg-white/95 dark:bg-zinc-950/95 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-zinc-600 dark:text-zinc-300 text-sm">加密发送中...</p>
          </div>
        </div>
      )}

      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowQRModal(false)}>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 max-w-xs w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">连接其他设备</h3>
              <button onClick={() => setShowQRModal(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex flex-col items-center">
              <div className="p-3 bg-white rounded-xl mb-3"><QRCodeSVG value={shareUrl} size={160} level="H" includeMargin={false} /></div>
              <p className="text-xs text-zinc-500 text-center mb-3">扫描二维码即可连接</p>
              <div className="flex items-center gap-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg p-2">
                <input type="text" readOnly value={shareUrl} className="flex-1 bg-transparent text-xs text-zinc-500 outline-none truncate" />
                <button onClick={() => copyToClipboard(shareUrl, "share-url")} className="p-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-md shrink-0">{copiedId === "share-url" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAllMessages && (
        <div className="fixed inset-0 z-40 bg-white dark:bg-zinc-950 flex flex-col lg:hidden">
          <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <h3 className="font-semibold">全部消息 ({messages.length})</h3>
            <div className="flex items-center gap-2">
              {messages.length > 0 && <button onClick={clearMessages} className="text-xs text-red-500 px-2.5 py-1 bg-red-50 dark:bg-red-500/10 rounded-md">清空</button>}
              <button onClick={() => setShowAllMessages(false)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-zinc-400"><ShieldCheck className="w-10 h-10 opacity-30 mb-2" /><p className="text-sm">暂无消息</p></div> : messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Desktop */}
      <div className="hidden lg:flex flex-1 p-4 max-w-6xl mx-auto w-full gap-4 min-h-0">
        <div className="w-72 flex flex-col gap-4 shrink-0">
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg"><ShieldCheck className="w-5 h-5" /></div>
              <div><h1 className="font-semibold">OpenClaw Drop</h1><p className="text-xs text-zinc-500">端到端加密传输</p></div>
            </div>
            <div className="flex flex-col items-center p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"><QRCodeSVG value={shareUrl} size={140} level="H" includeMargin={false} /></div>
            <p className="text-xs text-zinc-500 text-center mt-2">扫描二维码连接</p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">{isConnected ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}<span className="text-sm">{isConnected ? "已连接" : "已断开"}</span></div>
              <span className="text-sm bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-md">{peersCount} 设备</span>
            </div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-700 dark:text-zinc-300">自动添加到剪贴板</span>
              <button onClick={() => setAutoCopyToClipboard(!autoCopyToClipboard)} className={cn("relative w-11 h-6 rounded-full transition-colors", autoCopyToClipboard ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600")}>
                <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform", autoCopyToClipboard ? "translate-x-5" : "translate-x-0.5")} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl min-h-0">
          <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
            <h2 className="font-medium text-sm">安全传输</h2>
            {messages.length > 0 && <button onClick={clearMessages} className="text-xs flex items-center gap-1 text-zinc-500 hover:text-red-500 px-2 py-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800"><Trash2 className="w-3 h-3" />清空</button>}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-zinc-400"><ShieldCheck className="w-10 h-10 opacity-30 mb-2" /><p className="text-sm">等待接收消息...</p></div> : messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
            <div className="flex items-end gap-2">
              <textarea ref={textareaRef} value={textInput} onChange={(e) => setTextInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendText(); }}} placeholder="输入消息..." className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[40px] max-h-24" rows={1} />
              <input type="file" ref={fileInputRef} onChange={handleFileInput} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg"><FileUp className="w-5 h-5" /></button>
              <button onClick={() => handleSendText()} disabled={!textInput.trim()} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">发送</button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="lg:hidden flex-1 flex flex-col min-h-0" style={{ paddingBottom: keyboardOpen ? 'env(keyboard-inset-height, 0px)' : 0 }}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0" style={{ display: keyboardOpen ? 'none' : 'flex' }}>
          <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /><span className="font-semibold text-sm">OpenClaw Drop</span></div>
          <div className="flex items-center gap-2">
            <div className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded-full", isConnected ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400")}>{isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}<span>{peersCount}</span></div>
            <button onClick={() => setShowQRModal(true)} className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg"><QrCode className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 flex flex-col px-3 py-2 overflow-y-auto min-h-0" style={{ display: keyboardOpen ? 'none' : 'flex' }}>
          {messages.length > 0 && (
            <div className="mb-2 shrink-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-500">最近消息</span>
                <button onClick={() => setShowAllMessages(true)} className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 py-0.5">全部 ({messages.length})<ChevronRight className="w-3 h-3" /></button>
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-900 rounded-xl p-2 space-y-2">{recentMessages.map(renderMessage)}</div>
            </div>
          )}
          <div className="flex-1 flex flex-col justify-center gap-2.5 py-3">
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
              <span className="text-sm text-zinc-700 dark:text-zinc-300">自动添加到剪贴板</span>
              <button onClick={() => setAutoCopyToClipboard(!autoCopyToClipboard)} className={cn("relative w-11 h-6 rounded-full transition-colors", autoCopyToClipboard ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600")}>
                <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform", autoCopyToClipboard ? "translate-x-5" : "translate-x-0.5")} />
              </button>
            </div>
            <button onClick={pasteAndSend} className="w-full py-4 bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm"><ClipboardPaste className="w-5 h-5" />粘贴并发送</button>
            <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700 rounded-xl font-medium flex items-center justify-center gap-2"><FileUp className="w-5 h-5" />选择文件</button>
            <input type="file" ref={fileInputRef} onChange={handleFileInput} className="hidden" />
          </div>
        </div>
        <div className={cn("shrink-0 px-3 pt-2 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950", keyboardOpen ? "pb-safe fixed bottom-0 left-0 right-0 z-50" : "pb-3")}>
          <div className="flex gap-2">
            <textarea ref={textareaRef} value={textInput} onChange={(e) => setTextInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendText(); }}} placeholder="手动输入文字..." className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[44px] max-h-20" rows={1} />
            <button onClick={() => handleSendText()} disabled={!textInput.trim()} className="px-4 bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 disabled:active:bg-emerald-600 text-white rounded-xl font-medium flex items-center justify-center"><Send className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}