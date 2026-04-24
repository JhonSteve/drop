import { useCallback, useEffect, useRef, useState } from "react";

import { deriveKeyWithPassword, generateRoomKey } from "../lib/crypto";

interface SubmitPasswordOptions {
  onSuccess: (roomKey: string, key: CryptoKey) => void | Promise<void>;
  onError: (message: string) => void;
}

interface CreatePasswordRoomOptions extends SubmitPasswordOptions {
  password: string;
}

export function useRoomSecurity() {
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [autoCopyToClipboard, setAutoCopyToClipboard] = useState(false);
  const autoCopyRef = useRef(false);

  useEffect(() => {
    autoCopyRef.current = autoCopyToClipboard;
  }, [autoCopyToClipboard]);

  const submitPassword = useCallback(
    async ({ onSuccess, onError }: SubmitPasswordOptions) => {
      const hash = window.location.hash.slice(1);
      const roomKey = hash.split(":")[0];
      const password = passwordInput.trim();

      if (!roomKey || !password) {
        onError("请输入房间密码");
        return false;
      }

      try {
        const key = await deriveKeyWithPassword(roomKey, password);
        await onSuccess(roomKey, key);
        setNeedsPassword(false);
        setPasswordInput("");
        return true;
      } catch {
        onError("密码错误或无法解密");
        return false;
      }
    },
    [passwordInput],
  );

  const createPasswordRoom = useCallback(
    async ({ password, onSuccess, onError }: CreatePasswordRoomOptions) => {
      const trimmedPassword = password.trim();
      if (!trimmedPassword) {
        onError("请输入房间密码");
        return false;
      }

      try {
        const roomKey = generateRoomKey();
        const key = await deriveKeyWithPassword(roomKey, trimmedPassword);
        window.history.replaceState(null, "", `#${roomKey}:pw`);
        setHasPassword(true);
        setNeedsPassword(false);
        setPasswordInput("");
        await onSuccess(roomKey, key);
        return true;
      } catch {
        onError("无法创建密码房间");
        return false;
      }
    },
    [],
  );

  return {
    needsPassword,
    setNeedsPassword,
    passwordInput,
    setPasswordInput,
    hasPassword,
    setHasPassword,
    autoCopyToClipboard,
    setAutoCopyToClipboard,
    autoCopyRef,
    submitPassword,
    createPasswordRoom,
  };
}

