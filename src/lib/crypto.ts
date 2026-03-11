/**
 * Derives an AES-GCM key from a password/passphrase string.
 */
export async function deriveKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const salt = enc.encode("openclaw-e2ee-salt-v1");

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Envelope structure for encrypted payloads.
 * All metadata is encrypted together with the data.
 */
export interface EncryptedEnvelope {
  iv: string;       // base64-encoded IV
  ciphertext: string; // base64-encoded ciphertext
}

export type MessageType = "text" | "file";

export interface PlaintextPayload {
  type: MessageType;
  // For text messages
  text?: string;
  // For file messages
  fileName?: string;
  fileType?: string;
  fileData?: string; // base64-encoded file data
}

/**
 * Encrypts a full payload (including metadata) into an opaque envelope.
 * The server never sees message type, file names, or content.
 */
export async function encryptPayload(
  key: CryptoKey,
  payload: PlaintextPayload
): Promise<EncryptedEnvelope> {
  const plaintext = JSON.stringify(payload);
  const buffer = new TextEncoder().encode(plaintext);

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    buffer
  );

  return {
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

/**
 * Decrypts an opaque envelope back into a PlaintextPayload.
 */
export async function decryptPayload(
  key: CryptoKey,
  envelope: EncryptedEnvelope
): Promise<PlaintextPayload> {
  const iv = new Uint8Array(base64ToArrayBuffer(envelope.iv));
  const ciphertext = base64ToArrayBuffer(envelope.ciphertext);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  const json = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(json) as PlaintextPayload;
}

/**
 * Helper to convert ArrayBuffer to Base64 string.
 * Chunked for Safari compatibility.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.slice(i, i + chunk)));
  }
  return window.btoa(binary);
}

/**
 * Helper to convert Base64 string to ArrayBuffer.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generates a random room key (32 hex chars = 128 bits).
 */
export function generateRoomKey(): string {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Derives a Room ID from the Room Key via SHA-256 hash.
 * The server only sees this derived ID, never the key itself.
 */
export async function deriveRoomId(roomKey: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(roomKey + "-room-id");
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
}
