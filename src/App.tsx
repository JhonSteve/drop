import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import { Copy, FileUp, Send, Check, ShieldCheck, Download, Trash2, Wifi, WifiOff, ClipboardPaste, X, QrCode, ChevronRight, ChevronDown, ChevronUp, FolderUp, Users } from "lucide-react";
import JSZip from "jszip";
import {
  encryptPayload,
  decryptPayload,
  generateRoomKey,
  deriveKey,
  deriveKeyWithPassword,
  deriveRoomId,
  deriveRoomIdFromKey,
  base64ToArrayBuffer,
  type MessageType,
  type EncryptedEnvelope,
  type FileChunk,
} from "./lib/crypto";
import type { WorkerResponse } from "./lib/file-worker";
import { cn } from "./lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

/**
 * Sanitizes a file name to prevent path traversal attacks.
 * Inspired by LocalSend CVE-2025-27142 and Magic Wormhole CVE-2026-32116.
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/\.\./g, '')        // Remove parent directory references
    .replace(/[\/\\]/g, '_')     // Replace path separators
    .replace(/^\.+/, '')         // Remove leading dots
    .replace(/[\x00-\x1f]/g, '') // Remove control characters
    .substring(0, 255)           // Limit length
    || 'unnamed';                // Fallback if empty
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  const markdownPatterns = [
    /^#{1,6}\s/m,          // headings
    /\*\*[^*]+\*\*/,       // bold
    /\*[^*]+\*/,           // italic
    /`[^`]+`/,             // inline code
    /```[\s\S]*```/,       // code blocks
    /^\s*[-*+]\s/m,        // unordered lists
    /^\s*\d+\.\s/m,        // ordered lists
    /^\s*>\s/m,            // blockquotes
    /\[.+\]\(.+\)/,        // links
    /\|.+\|.+\|/,          // tables
    /^---+$/m,             // horizontal rules
  ];
  return markdownPatterns.some(pattern => pattern.test(text));
}

const MessageBubble = React.memo(function MessageBubble({ msg, isMe, copiedId, onCopy, onDownload }: {
  msg: Message;
  isMe: boolean;
  copiedId: string | null;
  onCopy: (text: string, messageId: string) => void;
  onDownload: (fileData: ArrayBuffer, fileName: string, fileType: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const content = msg.content || "";
  const isLongText = content.length >= 200;
  const isMarkdown = looksLikeMarkdown(content);

  return (
    <div className={cn("flex flex-col max-w-[88%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
      <div className="text-[10px] text-zinc-400 mb-1 px-1">{new Date(msg.timestamp).toLocaleTimeString()}</div>
      {msg.type === "text" ? (
        <div className={cn(
          "px-3 py-2 rounded-2xl text-sm max-w-full",
          isMe
            ? "bg-emerald-600 text-white rounded-tr-md"
            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-tl-md"
        )}>
          {/* Text content with collapse/expand */}
          <div className={cn(
            "whitespace-pre-wrap break-words",
            isLongText && !expanded && "line-clamp-5"
          )}>
            {isMarkdown ? (
              <div className={cn(
                "prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1 prose-pre:my-1 prose-code:text-xs prose-pre:bg-black/20 dark:prose-pre:bg-black/40",
                isLongText && !expanded && "max-h-[120px] overflow-hidden relative",
                expanded && "max-h-none"
              )}>
                {!expanded && isLongText && (
                  <div className={cn(
                    "absolute bottom-0 left-0 right-0 h-8 pointer-events-none z-10",
                    isMe
                      ? "bg-gradient-to-t from-emerald-600 to-transparent"
                      : "bg-gradient-to-t from-zinc-200 dark:from-zinc-700 to-transparent"
                  )} />
                )}
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre: ({ children }) => (
                      <pre className="max-h-[200px] overflow-auto rounded-lg bg-black/20 dark:bg-black/40 p-2">
                        {children}
                      </pre>
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <span className={cn(
                isLongText && !expanded && "line-clamp-5 overflow-hidden block"
              )}>
                {content}
              </span>
            )}
          </div>

          {/* Action buttons row */}
          <div className="flex items-center gap-2 mt-1.5 -mb-0.5">
            {/* Expand/collapse button for long text */}
            {isLongText && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[11px] opacity-70 hover:opacity-100 flex items-center gap-0.5 underline-offset-2 hover:underline transition-opacity"
              >
                {expanded ? (
                  <>收起<ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>展开全文<ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            )}

            {/* Copy button */}
            <button
              onClick={() => onCopy(content, msg.id)}
              className="inline-flex opacity-50 hover:opacity-100 p-0.5 transition-opacity"
            >
              {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>

            {/* Character count for long text */}
            {isLongText && (
              <span className="text-[10px] opacity-40">{content.length} 字</span>
            )}
          </div>
        </div>
      ) : (
        <div className={cn("p-2 rounded-2xl flex items-center gap-2 max-w-full", isMe ? "bg-emerald-100 dark:bg-emerald-600/30 border border-emerald-300 dark:border-emerald-500/40 rounded-tr-md" : "bg-zinc-200 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-tl-md")}>
          <div className={cn("p-1.5 rounded-lg shrink-0", isMe ? "bg-emerald-200 dark:bg-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "bg-zinc-300 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300")}><FileUp className="w-4 h-4" /></div>
          <div className="flex flex-col min-w-0 flex-1"><span className="text-xs font-medium truncate">{msg.fileName}</span><span className="text-[10px] text-zinc-500">{msg.fileSize ? formatFileSize(msg.fileSize) : "未知"}</span></div>
          <button onClick={() => msg.fileData && onDownload(msg.fileData, msg.fileName!, msg.fileType || "")} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg shrink-0"><Download className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
});

function AutoCopyToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={cn("relative w-11 h-6 rounded-full transition-colors", enabled ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600")}>
      <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform", enabled ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
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
  const [isZipping, setIsZipping] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [autoCopyToClipboard, setAutoCopyToClipboard] = useState(false);
  const autoCopyRef = useRef(true);
  const seenNonces = useRef<Set<string>>(new Set());
  const incomingChunks = useRef<Map<string, { chunks: Map<number, Uint8Array>; meta: { totalChunks: number; fileName: string; fileType: string; fileSize: number } }>>(new Map());
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [activeRooms, setActiveRooms] = useState<Array<{ roomId: string; members: number }>>([]);

  useEffect(() => {
    if (!errorToast) return;
    const timer = setTimeout(() => setErrorToast(null), 4000);
    return () => clearTimeout(timer);
  }, [errorToast]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
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
      const hash = window.location.hash.slice(1);

      // Parse hash format: "roomKey" or "roomKey:pw"
      const hashParts = hash.split(":");
      const roomKey = hashParts[0];
      const isPasswordProtected = hashParts[1] === "pw";

      if (!hash) {
        // Generate new room key (no password)
        const newKey = generateRoomKey();
        window.history.replaceState(null, "", `#${newKey}`);
        const key = await deriveKey(newKey);
        setCryptoKey(key);
        const id = await deriveRoomId(newKey);
        setRoomId(id);
      } else if (isPasswordProtected) {
        // Password-protected room - wait for password input
        setHasPassword(true);
        setNeedsPassword(true);
        const id = await deriveRoomIdFromKey(roomKey);
        setRoomId(id);
      } else {
        // Regular room (no password, backwards compatible)
        const key = await deriveKey(roomKey);
        setCryptoKey(key);
        const id = await deriveRoomId(roomKey);
        setRoomId(id);
      }
    };
    initRoom();
    const onHashChange = () => window.location.reload();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // 从 localStorage 读取历史消息
  useEffect(() => {
    if (roomId) {
      const storageKey = `drop-messages-${roomId}`;
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
    if (!roomId || !cryptoKey) return undefined;
    const newSocket = io(window.location.origin, {
      transports: ["websocket", "polling"],
    });
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
    newSocket.on("room-list-update", (rooms: Array<{ roomId: string; members: number }>) => {
      setActiveRooms(rooms);
    });
    newSocket.on("receive-message", async (data: { senderId: string; payload: EncryptedEnvelope; timestamp: number }) => {
      try {
        const { senderId, payload, timestamp } = data;
        const decrypted = await decryptPayload(cryptoKey, payload);
        
        // Replay attack protection: check nonce
        if (decrypted.nonce) {
          if (seenNonces.current.has(decrypted.nonce)) {
            console.warn("Replay attack detected: duplicate nonce");
            return;
          }
          seenNonces.current.add(decrypted.nonce);
          // Keep only last 1000 nonces to prevent memory leak
          if (seenNonces.current.size > 1000) {
            const arr = Array.from(seenNonces.current);
            seenNonces.current = new Set(arr.slice(-500));
          }
        }
        
        // Timestamp validation: reject messages older than 5 minutes
        const msgTimestamp = decrypted.timestamp || timestamp;
        if (Date.now() - msgTimestamp > 5 * 60 * 1000) {
          console.warn("Message rejected: too old");
          return;
        }
        
        // Validate message type before processing
        if (decrypted.type !== "text" && decrypted.type !== "file") {
          console.error("Invalid message type:", decrypted.type);
          return;
        }

        // Handle chunked file transfer
        if (decrypted.chunk) {
          const { fileId, chunkIndex, totalChunks, fileName, fileType, fileSize, chunkData } = decrypted.chunk;
          
          // Initialize chunk tracker for this file if needed
          if (!incomingChunks.current.has(fileId)) {
            incomingChunks.current.set(fileId, {
              chunks: new Map(),
              meta: { totalChunks, fileName, fileType, fileSize }
            });
          }
          
          const fileTracker = incomingChunks.current.get(fileId)!;
          
          // Decode chunk data
          const chunkBytes = new Uint8Array(base64ToArrayBuffer(chunkData));
          fileTracker.chunks.set(chunkIndex, chunkBytes);
          
          // Check if all chunks received
          if (fileTracker.chunks.size === totalChunks) {
            // Reassemble file
            const completeFile = new Uint8Array(fileSize);
            let offset = 0;
            for (let i = 0; i < totalChunks; i++) {
              const chunk = fileTracker.chunks.get(i);
              if (!chunk) {
                console.error("Missing chunk:", i);
                incomingChunks.current.delete(fileId);
                return;
              }
              completeFile.set(chunk, offset);
              offset += chunk.length;
            }
            
            // Add to messages
            setMessages(prev => [...prev, {
              id: `${senderId}-${timestamp}-${fileId}`,
              type: "file",
              senderId,
              timestamp,
              fileName: sanitizeFileName(fileName),
              fileType,
              fileData: completeFile.buffer,
              fileSize,
            }]);
            
            // Clean up
            incomingChunks.current.delete(fileId);
          }
          
          return; // Don't process as regular message
        }

        const newMessage: Message = { id: `${senderId}-${timestamp}`, type: decrypted.type, senderId, timestamp };
        if (decrypted.type === "text") {
          if (typeof decrypted.text !== "string") {
            console.error("Invalid text message: text is not a string");
            return;
          }
          newMessage.content = decrypted.text;
          if (autoCopyRef.current && decrypted.text) {
            navigator.clipboard.writeText(decrypted.text).catch(() => {});
          }
        } else if (decrypted.type === "file") {
          if (!decrypted.fileData || typeof decrypted.fileData !== "string") {
            console.error("Invalid file message: missing fileData");
            return;
          }
          const fileBuffer = base64ToArrayBuffer(decrypted.fileData);
          newMessage.fileName = sanitizeFileName(decrypted.fileName || "unknown");
          newMessage.fileType = decrypted.fileType || "application/octet-stream";
          newMessage.fileData = fileBuffer;
          newMessage.fileSize = fileBuffer.byteLength;
        }
        setMessages((prev) => [...prev, newMessage]);
      } catch (err) {
        console.error("Failed to decrypt message", err);
      }
    });
    return () => { newSocket.disconnect(); };
  }, [roomId, cryptoKey]);

  // 保存消息到 localStorage
  useEffect(() => {
    if (!roomId) return;
    const storageKey = `drop-messages-${roomId}`;
    // Don't save fileData to localStorage — it's too large and ephemeral
    // (crypto key changes each session, so persisted file data is unrecoverable)
    const toSave = messages.map(({ fileData: _fileData, ...rest }) => ({
      ...rest,
      fileData: undefined,
    }));
    try {
      // Keep only the latest 100 messages to avoid localStorage quota issues
      localStorage.setItem(storageKey, JSON.stringify(toSave.slice(-100)));
    } catch (e) {
      console.warn("Failed to save messages to localStorage:", e);
      // If saving fails, try clearing and saving with fewer messages
      try {
        localStorage.removeItem(storageKey);
        localStorage.setItem(storageKey, JSON.stringify(toSave.slice(-10)));
      } catch (e2) {
        console.error("localStorage is unavailable:", e2);
      }
    }
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
      setMessages((prev) => [...prev, { id: `me-${crypto.randomUUID()}`, type: "text", senderId: socket.id || "me", timestamp: Date.now(), content: contentToSend }]);
      setTextInput("");
    } catch (err) {
      console.error("Failed to send text", err);
    }
  }, [textInput, socket, cryptoKey, roomId]);

  const sendFile = useCallback(
    (file: File) => {
      if (!socket || !cryptoKey || !roomId || !workerRef.current) return;
      setIsSending(true);
      setUploadProgress({ current: 0, total: file.size, fileName: file.name });

      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const handler = (e: MessageEvent<WorkerResponse>) => {
        const data = e.data;
        if (data.id !== requestId) return;

        if (data.type === "encrypt-file-error") {
          console.error("Failed to send file:", data.error);
          setErrorToast(`发送失败: ${data.error}`);
          setIsSending(false);
          setUploadProgress(null);
          workerRef.current?.removeEventListener("message", handler);
          return;
        }

        if (data.type === "encrypt-progress") {
          setUploadProgress({
            current: data.progress * file.size,
            total: file.size,
            fileName: file.name,
          });
          return;
        }

        // Handle small files (single envelope)
        if (data.type === "encrypt-file-done") {
          socket.emit("send-message", { roomId, payload: data.envelope });

          setMessages((prev) => [
            ...prev,
            {
              id: `me-${crypto.randomUUID()}`,
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
          setUploadProgress(null);
          workerRef.current?.removeEventListener("message", handler);
          return;
        }

        // Handle large files (chunked transfer)
        if (data.type === "encrypt-chunks-done") {
          // Send all chunks with small delays between them
          data.chunks.forEach(({ envelope }, index) => {
            setTimeout(() => {
              socket.emit("send-message", { roomId, payload: envelope });
            }, index * 50); // 50ms between chunks
          });

          // Add placeholder message to show file was sent
          // The actual file data isn't available since we sent chunks,
          // but we keep the file reference for display
          setMessages((prev) => [
            ...prev,
            {
              id: `me-${crypto.randomUUID()}`,
              type: "file" as MessageType,
              senderId: socket.id || "me",
              timestamp: Date.now(),
              fileName: data.fileName,
              fileType: data.fileType,
              fileData: undefined, // Chunks don't retain original data
              fileSize: data.fileSize,
            },
          ]);

          setIsSending(false);
          setUploadProgress(null);
          workerRef.current?.removeEventListener("message", handler);
        }
      };

      workerRef.current.addEventListener("message", handler);

      // Read file as ArrayBuffer and transfer it to the worker
      file.arrayBuffer().then((arrayBuffer) => {
        setUploadProgress({
          current: arrayBuffer.byteLength,
          total: arrayBuffer.byteLength,
          fileName: file.name,
        });
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
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      // Check total size
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > MAX_FILE_SIZE) {
        setErrorToast(
          `总文件大小 (${formatFileSize(totalSize)}) 超过 ${formatFileSize(MAX_FILE_SIZE)} 上限`
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Warn about large files on mobile
      const isMobile = window.innerWidth < 1024;
      if (isMobile && totalSize > 50 * 1024 * 1024) {
        console.warn(
          `Large files (${formatFileSize(totalSize)}) on mobile may cause memory issues`
        );
      }

      // Send files sequentially
      files.forEach((file, index) => {
        setTimeout(() => sendFile(file), index * 100); // Stagger sends by 100ms
      });

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [sendFile]
  );

  const handleFolderInput = useCallback(
    async (e: { target: { files: FileList | null } }) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      setIsZipping(true);

      try {
        const zip = new JSZip();

        // Add all files to zip with their relative paths
        files.forEach((file) => {
          // Extract relative path from webkitRelativePath
          const relativePath = (file as any).webkitRelativePath as string || file.name;
          zip.file(relativePath, file);
        });

        // Generate zip blob
        const zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 }
        }, (metadata) => {
          // Update progress during zip creation
          setUploadProgress({
            current: metadata.percent,
            total: 100,
            fileName: `压缩中... ${Math.round(metadata.percent)}%`
          });
        });

        // Check size
        if (zipBlob.size > MAX_FILE_SIZE) {
          setErrorToast(`文件夹压缩后 (${formatFileSize(zipBlob.size)}) 超过 ${formatFileSize(MAX_FILE_SIZE)} 上限`);
          setIsZipping(false);
          setUploadProgress(null);
          return;
        }

        // Convert to File object and send
        const folderName = files[0] ? ((files[0] as any).webkitRelativePath as string).split("/")[0] : "folder";
        const zipFile = new File([zipBlob], `${folderName}.zip`, { type: "application/zip" });

        setIsZipping(false);
        setUploadProgress(null);
        sendFile(zipFile);

      } catch (error) {
        console.error("Failed to zip folder:", error);
        setErrorToast("文件夹压缩失败");
        setIsZipping(false);
        setUploadProgress(null);
      }
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
      const storageKey = `drop-messages-${roomId}`;
      localStorage.removeItem(storageKey);
    }
  }, [roomId]);

  const submitPassword = useCallback(async () => {
    const hash = window.location.hash.slice(1);
    const roomKey = hash.split(":")[0];
    if (!roomKey || !passwordInput.trim()) return;

    try {
      const key = await deriveKeyWithPassword(roomKey, passwordInput.trim());
      setCryptoKey(key);
      setNeedsPassword(false);
      setPasswordInput("");
    } catch (err) {
      setErrorToast("密码错误或无法解密");
    }
  }, [passwordInput]);

  const createPasswordRoom = useCallback(() => {
    const password = prompt("设置房间密码：");
    if (!password || !password.trim()) return;

    const roomKey = generateRoomKey();
    window.history.replaceState(null, "", `#${roomKey}:pw`);
    window.location.reload();
  }, []);

  const shareUrl = window.location.href;
  const recentMessages = useMemo(() => messages.slice(-3), [messages]);

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

      {needsPassword && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-950 flex items-center justify-center p-6">
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-6 h-6 text-amber-500" />
              <h2 className="font-semibold">密码保护房间</h2>
            </div>
            <p className="text-sm text-zinc-500 mb-4">此房间设置了密码保护，请输入密码以加入。</p>
            <div className="flex flex-col gap-3">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitPassword(); }}
                placeholder="输入房间密码"
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                autoFocus
              />
              <button onClick={submitPassword} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium">
                进入房间
              </button>
            </div>
          </div>
        </div>
      )}

      {(isSending || isZipping) && uploadProgress && (
        <div className="fixed inset-0 z-50 bg-white/95 dark:bg-zinc-950/95 flex items-center justify-center">
          <div className="text-center w-64">
            <div className="w-10 h-10 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-zinc-600 dark:text-zinc-300 text-sm mb-2">{isZipping ? "压缩中..." : "加密发送中..."}</p>
            <p className="text-xs text-zinc-500 mb-2 truncate">{uploadProgress.fileName}</p>
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-200"
                style={{
                  width: `${Math.min((uploadProgress.current / uploadProgress.total) * 100, 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {isZipping ? `${Math.round(uploadProgress.current)}%` : `${formatFileSize(uploadProgress.current)} / ${formatFileSize(uploadProgress.total)}`}
            </p>
          </div>
        </div>
      )}

      {isSending && !uploadProgress && (
        <div className="fixed inset-0 z-50 bg-white/95 dark:bg-zinc-950/95 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-zinc-600 dark:text-zinc-300 text-sm">准备中...</p>
          </div>
        </div>
      )}

      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowQRModal(false)}>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 max-w-xs w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">连接其他设备</h3>
                {hasPassword && <span className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">已加密</span>}
              </div>
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
            {messages.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-zinc-400"><ShieldCheck className="w-10 h-10 opacity-30 mb-2" /><p className="text-sm">暂无消息</p></div> : messages.map((msg) => {
              const isMe = msg.senderId === socket?.id || msg.senderId === "me";
              return <MessageBubble key={msg.id} msg={msg} isMe={isMe} copiedId={copiedId} onCopy={copyToClipboard} onDownload={downloadFile} />;
            })}
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
              <div><h1 className="font-semibold">Drop</h1><p className="text-xs text-zinc-500">端到端加密传输</p></div>
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
            <button onClick={createPasswordRoom} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              创建密码房间
            </button>
            <p className="text-[10px] text-zinc-400 text-center mt-1">密码额外保护，需单独分享密码</p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">自动添加到剪贴板</span>
                <div className="relative group">
                  <span className="text-xs text-zinc-400 cursor-help">⚠️</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-zinc-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    注意：其他应用可能读取剪贴板
                  </div>
                </div>
              </div>
              <AutoCopyToggle enabled={autoCopyToClipboard} onToggle={() => setAutoCopyToClipboard(!autoCopyToClipboard)} />
            </div>
          </div>
          {/* Active Rooms */}
          {activeRooms.filter(r => r.roomId !== roomId).length > 0 && (
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
              <h3 className="text-xs font-medium text-zinc-500 mb-2 flex items-center gap-1">
                <Users className="w-3 h-3" />
                局域网活跃房间
              </h3>
              <div className="flex flex-col gap-1">
                {activeRooms.filter(r => r.roomId !== roomId).map((room) => (
                  <button
                    key={room.roomId}
                    onClick={() => {
                      window.location.hash = room.roomId;
                      window.location.reload();
                    }}
                    className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-between p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <span className="truncate">{room.roomId.slice(0, 12)}...</span>
                    <span className="text-zinc-400">{room.members} 人</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl min-h-0">
          <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
            <h2 className="font-medium text-sm">安全传输</h2>
            {messages.length > 0 && <button onClick={clearMessages} className="text-xs flex items-center gap-1 text-zinc-500 hover:text-red-500 px-2 py-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800"><Trash2 className="w-3 h-3" />清空</button>}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-zinc-400"><ShieldCheck className="w-10 h-10 opacity-30 mb-2" /><p className="text-sm">等待接收消息...</p></div> : messages.map((msg) => {
              const isMe = msg.senderId === socket?.id || msg.senderId === "me";
              return <MessageBubble key={msg.id} msg={msg} isMe={isMe} copiedId={copiedId} onCopy={copyToClipboard} onDownload={downloadFile} />;
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
            <div className="flex items-end gap-2">
<textarea ref={textareaRef} value={textInput} onChange={(e) => setTextInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendText(); }}} placeholder="输入消息..." className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[40px] max-h-24" rows={1} />
               <input type="file" ref={fileInputRef} onChange={handleFileInput} className="hidden" multiple />
               <input
                 type="file"
                 ref={folderInputRef}
                 onChange={handleFolderInput}
                 className="hidden"
                 /* @ts-expect-error webkitdirectory is not in types */
                 webkitdirectory=""
                 directory=""
               />
               <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg"><FileUp className="w-5 h-5" /></button>
               <button onClick={() => folderInputRef.current?.click()} disabled={isZipping} className="p-2.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg disabled:opacity-50"><FolderUp className="w-5 h-5" /></button>
               <button onClick={() => handleSendText()} disabled={!textInput.trim()} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">发送</button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="lg:hidden flex-1 flex flex-col min-h-0" style={{ paddingBottom: keyboardOpen ? 'env(keyboard-inset-height, 0px)' : 0 }}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0" style={{ display: keyboardOpen ? 'none' : 'flex' }}>
          <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /><span className="font-semibold text-sm">Drop</span></div>
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
              <div className="bg-zinc-100 dark:bg-zinc-900 rounded-xl p-2 space-y-2">{recentMessages.map((msg) => {
                const isMe = msg.senderId === socket?.id || msg.senderId === "me";
                return <MessageBubble key={msg.id} msg={msg} isMe={isMe} copiedId={copiedId} onCopy={copyToClipboard} onDownload={downloadFile} />;
              })}</div>
            </div>
          )}
          <div className="flex-1 flex flex-col justify-center gap-2.5 py-3">
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">自动添加到剪贴板</span>
                <div className="relative group">
                  <span className="text-xs text-zinc-400 cursor-help">⚠️</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-zinc-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    注意：其他应用可能读取剪贴板
                  </div>
                </div>
              </div>
              <AutoCopyToggle enabled={autoCopyToClipboard} onToggle={() => setAutoCopyToClipboard(!autoCopyToClipboard)} />
            </div>
<button onClick={pasteAndSend} className="w-full py-4 bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm"><ClipboardPaste className="w-5 h-5" />粘贴并发送</button>
             <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700 rounded-xl font-medium flex items-center justify-center gap-2"><FileUp className="w-5 h-5" />选择文件</button>
             <button onClick={() => folderInputRef.current?.click()} disabled={isZipping} className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"><FolderUp className="w-5 h-5" />{isZipping ? "压缩中..." : "发送文件夹"}</button>
             <input type="file" ref={fileInputRef} onChange={handleFileInput} className="hidden" multiple />
             <input
               type="file"
               ref={folderInputRef}
               onChange={handleFolderInput}
               className="hidden"
               /* @ts-expect-error webkitdirectory is not in types */
               webkitdirectory=""
               directory=""
             />
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