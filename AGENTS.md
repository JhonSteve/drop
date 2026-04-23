<claude-mem-context>
# Memory Context

# [openclaw-drop] recent context, 2026-04-23 9:18pm GMT+8

## Local command convention

Shell commands in this workspace should follow the local RTK instruction at `/Users/jhonsteve/.codex/RTK.md`: prefix normal shell commands with `rtk` where supported.

## Project understanding

Drop is a React + TypeScript + Vite application with an Express + Socket.IO server. Its purpose is cross-device text, clipboard, file, and folder transfer for personal or small trusted-device use. The server maintains rooms and relays encrypted payloads; browsers perform encryption, decryption, file chunking, file assembly, and local message history.

Key files:

- `server.ts`: HTTP/HTTPS server, Socket.IO rooms, 4-digit room codes, join approval, rate limiting, encrypted message relay, Vite middleware in development, static file serving in production.
- `src/App.tsx`: main UI and application state; currently owns room initialization, socket lifecycle, text/file flows, folder zipping, message history, mobile layout, desktop layout, and room-code approval UI.
- `src/lib/crypto.ts`: Web Crypto helpers for PBKDF2-derived AES-GCM keys, encrypted envelopes, room key generation, and room id derivation.
- `src/lib/file-worker.ts`: Web Worker for file encryption and 5MB chunk generation.
- `docs/superpowers/specs/2026-04-23-drop-project-design.md`: current project understanding and development blueprint.

## Important current judgment

The README says URL hash keys are not sent to the server and the server cannot decrypt content. Current room-code join behavior conflicts with that for normal non-password rooms: the client sends `window.location.hash.slice(1)` as `shareHash`, and `server.ts` stores/forwards it for approved room-code joins. For non-password rooms, this hash is enough to derive the AES-GCM key. Future security work should either redesign room-code joining so the server never receives decryptable key material, or update README/UI copy to describe the weaker reality.

## Suggested development priorities

1. Align security claims with implementation, especially around 4-digit room-code joining.
2. Split the oversized `src/App.tsx` into hooks and focused components before adding substantial features.
3. Improve large-file transfer reliability with chunk acknowledgement, retry, timeout cleanup, and receive progress.
4. Make password rooms a first-class UI flow instead of relying on `prompt`.
5. Consolidate production scripts and PID/log handling.
</claude-mem-context>
