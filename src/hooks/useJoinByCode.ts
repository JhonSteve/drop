import { useCallback, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";

interface UseJoinByCodeOptions {
  socket: Socket | null;
  isConnected: boolean;
  isJoinRequestPending: boolean;
  onErrorToast: (message: string) => void;
  onApproveJoinRequest: (requestId: string) => void;
  onRejectJoinRequest: (requestId: string) => void;
}

export function useJoinByCode({
  socket,
  isConnected,
  isJoinRequestPending,
  onErrorToast,
  onApproveJoinRequest,
  onRejectJoinRequest,
}: UseJoinByCodeOptions) {
  const [joinCodeInput, setJoinCodeInputState] = useState("");

  const setJoinCodeInput = useCallback((value: string) => {
    setJoinCodeInputState(value.replace(/\D/g, "").slice(0, 4));
  }, []);

  const handleJoinByCode = useCallback(() => {
    if (!/^\d{4}$/.test(joinCodeInput)) {
      onErrorToast("请输入4位数字房间号");
      return;
    }

    if (!socket || !isConnected) {
      onErrorToast("当前未连接到服务器，请稍后再试");
      return;
    }

    if (isJoinRequestPending) {
      onErrorToast("已有待确认的加入请求，请稍候");
      return;
    }

    socket.emit("request-join-by-code", { code: joinCodeInput });
  }, [isConnected, isJoinRequestPending, joinCodeInput, onErrorToast, socket]);

  const digitSlots = useMemo(
    () => Array.from({ length: 4 }, (_, index) => joinCodeInput[index] ?? ""),
    [joinCodeInput],
  );

  return {
    joinCodeInput,
    setJoinCodeInput,
    digitSlots,
    handleJoinByCode,
    handleApproveJoinRequest: onApproveJoinRequest,
    handleRejectJoinRequest: onRejectJoinRequest,
  };
}

