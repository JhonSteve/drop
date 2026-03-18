/// <reference lib="webworker" />

/**
 * Web Worker for offloading heavy file encryption from the main thread.
 * Uses `crypto.subtle` (available as a global in workers, not `window.crypto.subtle`).
 * Supports chunking for large files (> 10MB) to reduce memory pressure.
 */

import type { EncryptedEnvelope, PlaintextPayload, FileChunk } from "./crypto";

/** 5MB chunk size - imported locally to avoid module resolution issues in worker */
const CHUNK_SIZE = 5 * 1024 * 1024;

// --- Types ---

export type WorkerRequest = {
  type: "encrypt-file";
  id: string;
  key: CryptoKey;
  fileName: string;
  fileType: string;
  fileData: ArrayBuffer;
};

export type WorkerResponse =
  | {
      type: "encrypt-file-done";
      id: string;
      envelope: EncryptedEnvelope;
      fileData: ArrayBuffer;
      fileName: string;
      fileType: string;
    }
  | {
      type: "encrypt-chunks-done";
      id: string;
      chunks: Array<{ envelope: EncryptedEnvelope; chunkIndex: number }>;
      fileId: string;
      totalChunks: number;
      fileName: string;
      fileType: string;
      fileSize: number;
    }
  | {
      type: "encrypt-progress";
      id: string;
      progress: number;
    }
  | {
      type: "encrypt-file-error";
      id: string;
      error: string;
    };

// --- Inline crypto helpers (use `crypto.subtle`, not `window.crypto.subtle`) ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.slice(i, i + chunk))
    );
  }
  return btoa(binary);
}

async function encryptPayload(
  key: CryptoKey,
  payload: PlaintextPayload
): Promise<EncryptedEnvelope> {
  const payloadWithNonce = {
    ...payload,
    nonce: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  const plaintext = JSON.stringify(payloadWithNonce);
  const buffer = new TextEncoder().encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    buffer
  );
  return {
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

// --- Worker message handler ---

onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { type, id, key, fileName, fileType, fileData } = e.data;

  if (type !== "encrypt-file") return;

  try {
    const totalChunks = Math.ceil(fileData.byteLength / CHUNK_SIZE);

    // For small files (<= 2 chunks = ~10MB), send as single message
    if (totalChunks <= 2) {
      const fileDataBase64 = arrayBufferToBase64(fileData);
      const envelope = await encryptPayload(key, {
        type: "file",
        fileName,
        fileType,
        fileData: fileDataBase64,
      });

      const response: WorkerResponse = {
        type: "encrypt-file-done",
        id,
        envelope,
        fileData,
        fileName,
        fileType,
      };
      postMessage(response, [fileData]);
    } else {
      // For large files, split into chunks
      const fileId = crypto.randomUUID();
      const chunks: Array<{ envelope: EncryptedEnvelope; chunkIndex: number }> = [];

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileData.byteLength);
        const chunkData = fileData.slice(start, end);
        const chunkBase64 = arrayBufferToBase64(chunkData);

        const chunk: FileChunk = {
          fileId,
          chunkIndex: i,
          totalChunks,
          fileName,
          fileType,
          fileSize: fileData.byteLength,
          chunkData: chunkBase64,
        };

        const envelope = await encryptPayload(key, {
          type: "file",
          chunk,
        });

        chunks.push({ envelope, chunkIndex: i });

        // Report progress
        postMessage({
          type: "encrypt-progress",
          id,
          progress: (i + 1) / totalChunks,
        } as WorkerResponse);
      }

      const response: WorkerResponse = {
        type: "encrypt-chunks-done",
        id,
        chunks,
        fileId,
        totalChunks,
        fileName,
        fileType,
        fileSize: fileData.byteLength,
      };
      postMessage(response);
    }
  } catch (err) {
    const response: WorkerResponse = {
      type: "encrypt-file-error",
      id,
      error: err instanceof Error ? err.message : String(err),
    };
    postMessage(response);
  }
};

export {};