import { type Socket } from "socket.io-client";

export const MAX_FILE_SIZE = 500 * 1024 * 1024;

export function sanitizeFileName(fileName: string): string {
  return (
    fileName
      .replace(/\.\./g, "")
      .replace(/[\/\\]/g, "_")
      .replace(/^\.+/, "")
      .replace(/[\x00-\x1f]/g, "")
      .substring(0, 255) || "unnamed"
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  const markdownPatterns = [
    /^#{1,6}\s/m,
    /\*\*[^*]+\*\*/,
    /\*[^*]+\*/,
    /`[^`]+`/,
    /```[\s\S]*```/,
    /^\s*[-*+]\s/m,
    /^\s*\d+\.\s/m,
    /^\s*>\s/m,
    /\[.+\]\(.+\)/,
    /\|.+\|.+\|/,
    /^---+$/m,
  ];

  return markdownPatterns.some((pattern) => pattern.test(text));
}

export function isOwnMessage(senderId: string, socket: Socket | null) {
  return senderId === socket?.id || senderId === "me";
}

