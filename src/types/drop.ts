import type { MessageType } from "../lib/crypto";

export interface Message {
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

export interface ActiveRoomSummary {
  members: number;
}

export interface PendingRoomCodeJoinRequest {
  requestId: string;
  requesterLabel: string;
}

export interface UploadProgress {
  current: number;
  total: number;
  fileName: string;
}

export interface IncomingChunkMeta {
  totalChunks: number;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface IncomingChunkTracker {
  chunks: Map<number, Uint8Array>;
  meta: IncomingChunkMeta;
}

