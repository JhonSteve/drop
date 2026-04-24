import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import {
  deriveKey,
  deriveRoomId,
  deriveRoomIdFromKey,
  type EncryptedEnvelope,
  generateRoomKey,
} from "../lib/crypto";
import type { ActiveRoomSummary, PendingRoomCodeJoinRequest } from "../types/drop";

interface UseDropSessionOptions {
  onRequirePasswordChange: (required: boolean) => void;
  onHasPasswordChange: (enabled: boolean) => void;
  onErrorToast: (message: string) => void;
}

export function useDropSession({
  onRequirePasswordChange,
  onHasPasswordChange,
  onErrorToast,
}: UseDropSessionOptions) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState("");
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peersCount, setPeersCount] = useState(0);
  const [activeRooms, setActiveRooms] = useState<ActiveRoomSummary[]>([]);
  const [roomCode, setRoomCode] = useState("");
  const [isJoinRequestPending, setIsJoinRequestPending] = useState(false);
  const [pendingJoinRequestId, setPendingJoinRequestId] = useState<string | null>(null);
  const [joinRequestExpiresAt, setJoinRequestExpiresAt] = useState<number | null>(null);
  const [incomingJoinRequests, setIncomingJoinRequests] = useState<PendingRoomCodeJoinRequest[]>([]);
  const pendingJoinRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    pendingJoinRequestIdRef.current = pendingJoinRequestId;
  }, [pendingJoinRequestId]);

  const navigateToShareHash = useCallback(
    (shareHash: string | null) => {
      if (!shareHash) {
        onErrorToast("房间暂时不可加入，请让对方重新打开分享链接");
        return;
      }

      window.location.hash = shareHash;
      window.location.reload();
    },
    [onErrorToast],
  );

  const applyPasswordRoom = useCallback(
    async (roomKey: string, key: CryptoKey) => {
      setCryptoKey(key);
      setRoomId(await deriveRoomIdFromKey(roomKey));
      onHasPasswordChange(true);
      onRequirePasswordChange(false);
    },
    [onHasPasswordChange, onRequirePasswordChange],
  );

  const approveJoinRequest = useCallback(
    (requestId: string) => {
      if (!socket) return;
      socket.emit("approve-room-code-request", { requestId });
      setIncomingJoinRequests((prev) => prev.filter((request) => request.requestId !== requestId));
    },
    [socket],
  );

  const rejectJoinRequest = useCallback(
    (requestId: string) => {
      if (!socket) return;
      socket.emit("reject-room-code-request", { requestId });
      setIncomingJoinRequests((prev) => prev.filter((request) => request.requestId !== requestId));
    },
    [socket],
  );

  useEffect(() => {
    const initRoom = async () => {
      if (!window.crypto || !window.crypto.subtle) {
        return;
      }

      const hash = window.location.hash.slice(1);
      const [roomKey, passwordMarker] = hash.split(":");
      const isPasswordProtected = passwordMarker === "pw";

      if (!hash) {
        const newKey = generateRoomKey();
        window.history.replaceState(null, "", `#${newKey}`);
        setCryptoKey(await deriveKey(newKey));
        setRoomId(await deriveRoomId(newKey));
        onHasPasswordChange(false);
        onRequirePasswordChange(false);
        return;
      }

      if (isPasswordProtected) {
        onHasPasswordChange(true);
        onRequirePasswordChange(true);
        setCryptoKey(null);
        setRoomId(await deriveRoomIdFromKey(roomKey));
        return;
      }

      setCryptoKey(await deriveKey(roomKey));
      setRoomId(await deriveRoomId(roomKey));
      onHasPasswordChange(false);
      onRequirePasswordChange(false);
    };

    initRoom();
    const onHashChange = () => window.location.reload();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [onHasPasswordChange, onRequirePasswordChange]);

  useEffect(() => {
    if (!roomId || !cryptoKey) return undefined;

    setRoomCode("");
    setIsJoinRequestPending(false);
    setPendingJoinRequestId(null);
    setJoinRequestExpiresAt(null);
    setIncomingJoinRequests([]);

    const nextSocket = io(window.location.origin, {
      transports: ["websocket", "polling"],
    });

    setSocket(nextSocket);

    nextSocket.on("connect", () => {
      setIsConnected(true);
      nextSocket.emit("join-room", {
        roomId,
        shareHash: window.location.hash.slice(1),
      });
    });

    nextSocket.on("disconnect", () => {
      setIsConnected(false);
      setPeersCount(0);
      setRoomCode("");
      setActiveRooms([]);
    });

    nextSocket.on("room-count", (count: number) => setPeersCount(count));
    nextSocket.on("room-code", (code: string) => setRoomCode(code));
    nextSocket.on("room-list-update", (rooms: ActiveRoomSummary[]) => setActiveRooms(rooms));
    nextSocket.on("room-code-request-pending", (data: { requestId: string; expiresInMs?: number }) => {
      if (typeof data?.requestId !== "string") return;
      setPendingJoinRequestId(data.requestId);
      setIsJoinRequestPending(true);
      setJoinRequestExpiresAt(Date.now() + (typeof data?.expiresInMs === "number" ? data.expiresInMs : 60_000));
      onErrorToast("已发送加入请求，等待对方确认");
    });
    nextSocket.on("room-code-request-error", (data: { message: string }) => {
      setIsJoinRequestPending(false);
      setPendingJoinRequestId(null);
      setJoinRequestExpiresAt(null);
      if (typeof data?.message === "string" && data.message) {
        onErrorToast(data.message);
      }
    });
    nextSocket.on("room-code-join-request", (data: { requestId: string; requesterLabel?: string }) => {
      if (typeof data?.requestId !== "string") return;
      setIncomingJoinRequests((prev) => {
        if (prev.some((request) => request.requestId === data.requestId)) {
          return prev;
        }

        return [
          ...prev,
          {
            requestId: data.requestId,
            requesterLabel: data.requesterLabel?.trim() || "有设备",
          },
        ];
      });
    });
    nextSocket.on("room-code-approved", (data: { requestId: string; shareHash: string }) => {
      if (pendingJoinRequestIdRef.current && data?.requestId !== pendingJoinRequestIdRef.current) {
        return;
      }

      setIsJoinRequestPending(false);
      setPendingJoinRequestId(null);
      setJoinRequestExpiresAt(null);
      navigateToShareHash(data?.shareHash || null);
    });
    nextSocket.on("room-code-rejected", (data: { requestId: string }) => {
      if (pendingJoinRequestIdRef.current && data?.requestId !== pendingJoinRequestIdRef.current) {
        return;
      }

      setIsJoinRequestPending(false);
      setPendingJoinRequestId(null);
      setJoinRequestExpiresAt(null);
      onErrorToast("对方已拒绝加入请求");
    });
    nextSocket.on("room-code-request-expired", (data: { requestId: string }) => {
      setIncomingJoinRequests((prev) => prev.filter((request) => request.requestId !== data?.requestId));
      if (pendingJoinRequestIdRef.current && data?.requestId !== pendingJoinRequestIdRef.current) {
        return;
      }

      setIsJoinRequestPending(false);
      setPendingJoinRequestId(null);
      setJoinRequestExpiresAt(null);
      onErrorToast("请求已过期");
    });
    nextSocket.on("room-hash-conflict", () => {
      onErrorToast("房间链接校验失败，请重新打开分享链接");
    });

    return () => {
      nextSocket.off("room-count");
      nextSocket.off("room-code");
      nextSocket.off("room-list-update");
      nextSocket.off("room-code-request-pending");
      nextSocket.off("room-code-request-error");
      nextSocket.off("room-code-join-request");
      nextSocket.off("room-code-approved");
      nextSocket.off("room-code-rejected");
      nextSocket.off("room-code-request-expired");
      nextSocket.off("room-hash-conflict");
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [cryptoKey, navigateToShareHash, onErrorToast, roomId]);

  return {
    socket,
    roomId,
    cryptoKey,
    setCryptoKey,
    setRoomId,
    isConnected,
    peersCount,
    activeRooms,
    roomCode,
    setRoomCode,
    isJoinRequestPending,
    joinRequestExpiresAt,
    incomingJoinRequests,
    applyPasswordRoom,
    approveJoinRequest,
    rejectJoinRequest,
  };
}
