import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import type { Socket } from "socket.io-client";

import {
  base64ToArrayBuffer,
  decryptPayload,
  encryptPayload,
  type EncryptedEnvelope,
  type MessageType,
} from "../lib/crypto";
import { formatFileSize, looksLikeMarkdown, MAX_FILE_SIZE, sanitizeFileName } from "../lib/drop";
import type { WorkerResponse } from "../lib/file-worker";
import type { IncomingChunkTracker, Message, UploadProgress } from "../types/drop";

interface UseTransferTimelineOptions {
  socket: Socket | null;
  cryptoKey: CryptoKey | null;
  roomId: string;
  autoCopyRef: React.RefObject<boolean>;
  confirmLargeMobileTransfers?: boolean;
  onErrorToast: (message: string) => void;
}

interface PendingLargeTransfer {
  files: File[];
  title: string;
  description: string;
  confirmLabel: string;
}

export function useTransferTimeline({
  socket,
  cryptoKey,
  roomId,
  autoCopyRef,
  confirmLargeMobileTransfers = true,
  onErrorToast,
}: UseTransferTimelineOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [pendingLargeTransfer, setPendingLargeTransfer] = useState<PendingLargeTransfer | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const seenNonces = useRef<Set<string>>(new Set());
  const incomingChunks = useRef<Map<string, IncomingChunkTracker>>(new Map());

  useEffect(() => {
    workerRef.current = new Worker(new URL("../lib/file-worker.ts", import.meta.url), { type: "module" });
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    seenNonces.current = new Set();
    incomingChunks.current = new Map();

    if (!roomId) {
      setMessages([]);
      setPendingLargeTransfer(null);
      return;
    }
    const storageKey = `drop-messages-${roomId}`;
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      setMessages([]);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as Array<Omit<Message, "fileData">>;
      setMessages(parsed.map((message) => ({ ...message, fileData: undefined })));
    } catch (error) {
      console.error("Failed to parse saved messages", error);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const storageKey = `drop-messages-${roomId}`;
    const toSave = messages.map(({ fileData: _fileData, ...rest }) => ({ ...rest, fileData: undefined }));

    try {
      localStorage.setItem(storageKey, JSON.stringify(toSave.slice(-100)));
    } catch (error) {
      console.warn("Failed to save messages to localStorage:", error);
      try {
        localStorage.removeItem(storageKey);
        localStorage.setItem(storageKey, JSON.stringify(toSave.slice(-10)));
      } catch (fallbackError) {
        console.error("localStorage is unavailable:", fallbackError);
      }
    }
  }, [messages, roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!socket || !cryptoKey) return undefined;

    const handleReceiveMessage = async (data: {
      senderId: string;
      payload: EncryptedEnvelope;
      timestamp: number;
    }) => {
      try {
        const { senderId, payload, timestamp } = data;
        const decrypted = await decryptPayload(cryptoKey, payload);

        if (decrypted.nonce) {
          if (seenNonces.current.has(decrypted.nonce)) {
            console.warn("Replay attack detected: duplicate nonce");
            return;
          }

          seenNonces.current.add(decrypted.nonce);
          if (seenNonces.current.size > 1000) {
            const nextNonces = Array.from(seenNonces.current);
            seenNonces.current = new Set(nextNonces.slice(-500));
          }
        }

        const messageTimestamp = decrypted.timestamp || timestamp;
        if (Date.now() - messageTimestamp > 5 * 60 * 1000) {
          console.warn("Message rejected: too old");
          return;
        }

        if (decrypted.type !== "text" && decrypted.type !== "file") {
          console.error("Invalid message type:", decrypted.type);
          return;
        }

        if (decrypted.chunk) {
          const { fileId, chunkIndex, totalChunks, fileName, fileType, fileSize, chunkData } = decrypted.chunk;
          if (!incomingChunks.current.has(fileId)) {
            incomingChunks.current.set(fileId, {
              chunks: new Map(),
              meta: { totalChunks, fileName, fileType, fileSize },
            });
          }

          const fileTracker = incomingChunks.current.get(fileId);
          if (!fileTracker) {
            return;
          }

          const chunkBytes = new Uint8Array(base64ToArrayBuffer(chunkData));
          fileTracker.chunks.set(chunkIndex, chunkBytes);

          if (fileTracker.chunks.size === totalChunks) {
            const completeFile = new Uint8Array(fileSize);
            let offset = 0;
            for (let index = 0; index < totalChunks; index += 1) {
              const chunk = fileTracker.chunks.get(index);
              if (!chunk) {
                console.error("Missing chunk:", index);
                incomingChunks.current.delete(fileId);
                return;
              }

              completeFile.set(chunk, offset);
              offset += chunk.length;
            }

            setMessages((prev) => [
              ...prev,
              {
                id: `${senderId}-${timestamp}-${fileId}`,
                type: "file",
                senderId,
                timestamp,
                fileName: sanitizeFileName(fileName),
                fileType,
                fileData: completeFile.buffer,
                fileSize,
              },
            ]);

            incomingChunks.current.delete(fileId);
          }

          return;
        }

        const nextMessage: Message = {
          id: `${senderId}-${timestamp}`,
          type: decrypted.type,
          senderId,
          timestamp,
        };

        if (decrypted.type === "text") {
          if (typeof decrypted.text !== "string") {
            console.error("Invalid text message: text is not a string");
            return;
          }
          nextMessage.content = decrypted.text;
          if (autoCopyRef.current && decrypted.text) {
            navigator.clipboard.writeText(decrypted.text).catch(() => {});
          }
        } else {
          if (!decrypted.fileData || typeof decrypted.fileData !== "string") {
            console.error("Invalid file message: missing fileData");
            return;
          }

          const fileBuffer = base64ToArrayBuffer(decrypted.fileData);
          nextMessage.fileName = sanitizeFileName(decrypted.fileName || "unknown");
          nextMessage.fileType = decrypted.fileType || "application/octet-stream";
          nextMessage.fileData = fileBuffer;
          nextMessage.fileSize = fileBuffer.byteLength;
        }

        setMessages((prev) => [...prev, nextMessage]);
      } catch (error) {
        console.error("Failed to decrypt message", error);
      }
    };

    socket.on("receive-message", handleReceiveMessage);
    return () => {
      socket.off("receive-message", handleReceiveMessage);
    };
  }, [autoCopyRef, cryptoKey, socket]);

  const handleSendText = useCallback(
    async (text?: string) => {
      const contentToSend = text ?? textInput;
      if (!contentToSend.trim() || !socket || !cryptoKey || !roomId) return;

      try {
        const envelope = await encryptPayload(cryptoKey, { type: "text", text: contentToSend });
        socket.emit("send-message", { roomId, payload: envelope });
        setMessages((prev) => [
          ...prev,
          {
            id: `me-${crypto.randomUUID()}`,
            type: "text",
            senderId: socket.id || "me",
            timestamp: Date.now(),
            content: contentToSend,
          },
        ]);
        setTextInput("");
      } catch (error) {
        console.error("Failed to send text", error);
      }
    },
    [cryptoKey, roomId, socket, textInput],
  );

  const sendFile = useCallback(
    (file: File) => {
      if (!socket || !cryptoKey || !roomId || !workerRef.current) return;

      setIsSending(true);
      setUploadProgress({ current: 0, total: file.size, fileName: file.name });
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const handler = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data;
        if (data.id !== requestId) return;

        if (data.type === "encrypt-file-error") {
          onErrorToast(`发送失败: ${data.error}`);
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

        if (data.type === "encrypt-chunks-done") {
          data.chunks.forEach(({ envelope }, index) => {
            setTimeout(() => {
              socket.emit("send-message", { roomId, payload: envelope });
            }, index * 50);
          });

          setMessages((prev) => [
            ...prev,
            {
              id: `me-${crypto.randomUUID()}`,
              type: "file" as MessageType,
              senderId: socket.id || "me",
              timestamp: Date.now(),
              fileName: data.fileName,
              fileType: data.fileType,
              fileData: undefined,
              fileSize: data.fileSize,
            },
          ]);
          setIsSending(false);
          setUploadProgress(null);
          workerRef.current?.removeEventListener("message", handler);
        }
      };

      workerRef.current.addEventListener("message", handler);
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
          [arrayBuffer],
        );
      });
    },
    [cryptoKey, onErrorToast, roomId, socket],
  );

  const queueFilesForSend = useCallback(
    (files: File[]) => {
      files.forEach((file, index) => {
        setTimeout(() => sendFile(file), index * 100);
      });
    },
    [sendFile],
  );

  const handleFileInput = useCallback(
    (event: { target: { files: FileList | null } }) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      if (totalSize > MAX_FILE_SIZE) {
        onErrorToast(`总文件大小 (${formatFileSize(totalSize)}) 超过 ${formatFileSize(MAX_FILE_SIZE)} 上限`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const isMobile = window.innerWidth < 1024;
      if (confirmLargeMobileTransfers && isMobile && totalSize > 100 * 1024 * 1024) {
        setPendingLargeTransfer({
          files,
          title: "移动端大文件确认",
          description: `当前准备发送 ${files.length} 个文件，总大小约 ${formatFileSize(totalSize)}。移动网络下可能耗时较长，确认继续发送吗？`,
          confirmLabel: "继续发送",
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      queueFilesForSend(files);

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [confirmLargeMobileTransfers, onErrorToast, queueFilesForSend],
  );

  const handleFolderInput = useCallback(
    async (event: { target: { files: FileList | null } }) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      setIsZipping(true);

      try {
        const zip = new JSZip();
        files.forEach((file) => {
          const relativePath = ((file as File & { webkitRelativePath?: string }).webkitRelativePath as string) || file.name;
          zip.file(relativePath, file);
        });

        const zipBlob = await zip.generateAsync(
          {
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 6 },
          },
          (metadata) => {
            setUploadProgress({
              current: metadata.percent,
              total: 100,
              fileName: `压缩中... ${Math.round(metadata.percent)}%`,
            });
          },
        );

        if (zipBlob.size > MAX_FILE_SIZE) {
          onErrorToast(`文件夹压缩后 (${formatFileSize(zipBlob.size)}) 超过 ${formatFileSize(MAX_FILE_SIZE)} 上限`);
          setIsZipping(false);
          setUploadProgress(null);
          return;
        }

        const folderName = files[0]
          ? (((files[0] as File & { webkitRelativePath?: string }).webkitRelativePath as string).split("/")[0] || "folder")
          : "folder";
        const zipFile = new File([zipBlob], `${folderName}.zip`, { type: "application/zip" });

        const isMobile = window.innerWidth < 1024;
        if (confirmLargeMobileTransfers && isMobile && zipBlob.size > 100 * 1024 * 1024) {
          setIsZipping(false);
          setUploadProgress(null);
          setPendingLargeTransfer({
            files: [zipFile],
            title: "移动端大文件确认",
            description: `压缩包大小约 ${formatFileSize(zipBlob.size)}，移动端发送可能较慢，确认继续发送吗？`,
            confirmLabel: "继续发送",
          });
          return;
        }

        setIsZipping(false);
        setUploadProgress(null);
        sendFile(zipFile);
      } catch (error) {
        console.error("Failed to zip folder:", error);
        onErrorToast("文件夹压缩失败");
        setIsZipping(false);
        setUploadProgress(null);
      }
    },
    [confirmLargeMobileTransfers, onErrorToast, sendFile],
  );

  const confirmPendingLargeTransfer = useCallback(() => {
    if (!pendingLargeTransfer) {
      return;
    }

    const files = pendingLargeTransfer.files;
    setPendingLargeTransfer(null);
    queueFilesForSend(files);
  }, [pendingLargeTransfer, queueFilesForSend]);

  const cancelPendingLargeTransfer = useCallback(() => {
    setPendingLargeTransfer(null);
  }, []);

  const copyToClipboard = useCallback(async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy", error);
    }
  }, []);

  const pasteAndSend = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) await handleSendText(text);
    } catch (error) {
      console.error("Failed to read clipboard", error);
      onErrorToast("粘贴权限被拒绝 · 在浏览器设置中允许剪贴板访问");
    }
  }, [handleSendText, onErrorToast]);

  const downloadFile = useCallback((fileData: ArrayBuffer, fileName: string, fileType: string) => {
    const blob = new Blob([fileData], { type: fileType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    if (!roomId) return;
    const storageKey = `drop-messages-${roomId}`;
    localStorage.removeItem(storageKey);
  }, [roomId]);

  const recentMessages = useMemo(() => messages.slice(-3), [messages]);

  return {
    messages,
    setMessages,
    textInput,
    setTextInput,
    copiedId,
    isSending,
    isZipping,
    uploadProgress,
    pendingLargeTransfer,
    fileInputRef,
    folderInputRef,
    messagesEndRef,
    handleSendText,
    handleFileInput,
    handleFolderInput,
    copyToClipboard,
    pasteAndSend,
    downloadFile,
    clearMessages,
    confirmPendingLargeTransfer,
    cancelPendingLargeTransfer,
    recentMessages,
    formatFileSize,
    looksLikeMarkdown,
  };
}
