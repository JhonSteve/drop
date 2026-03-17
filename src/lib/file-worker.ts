/// <reference lib="webworker" />

/**
 * Web Worker for offloading heavy file encryption from the main thread.
 * Uses `crypto.subtle` (available as a global in workers, not `window.crypto.subtle`).
 */

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
      envelope: { iv: string; ciphertext: string };
      fileData: ArrayBuffer;
      fileName: string;
      fileType: string;
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
  payload: { type: "file"; fileName: string; fileType: string; fileData: string }
): Promise<{ iv: string; ciphertext: string }> {
  const plaintext = JSON.stringify(payload);
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
    // Convert ArrayBuffer to base64 off the main thread
    const fileDataBase64 = arrayBufferToBase64(fileData);

    // Encrypt the payload off the main thread
    const envelope = await encryptPayload(key, {
      type: "file",
      fileName,
      fileType,
      fileData: fileDataBase64,
    });

    // Note: fileName sanitization is handled by the main thread (App.tsx) via
    // sanitizeFileName() before display. The worker encrypts the original fileName
    // into the envelope so the receiver can apply their own sanitization on receipt.

    const response: WorkerResponse = {
      type: "encrypt-file-done",
      id,
      envelope,
      fileData,
      fileName,
      fileType,
    };

    // Transfer the ArrayBuffer back to avoid copying
    postMessage(response, [fileData]);
  } catch (err) {
    const response: WorkerResponse = {
      type: "encrypt-file-error",
      id,
      error: err instanceof Error ? err.message : String(err),
    };
    postMessage(response);
  }
};
