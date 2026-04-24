import { useEffect, useRef, useState } from "react";

export function useViewportComposer(textInput: string) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const desktopTextareaRef = useRef<HTMLTextAreaElement>(null);
  const mobileTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = window.innerWidth >= 1024 ? desktopTextareaRef.current : mobileTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "44px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
  }, [textInput]);

  useEffect(() => {
    const handleResize = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const fullHeight = window.innerHeight;
      const diff = fullHeight - currentHeight;

      if (diff > 150) {
        setKeyboardOpen(true);
        setViewportHeight(currentHeight);
      } else {
        setKeyboardOpen(false);
        setViewportHeight(fullHeight);
      }
    };

    window.visualViewport?.addEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return {
    keyboardOpen,
    viewportHeight,
    desktopTextareaRef,
    mobileTextareaRef,
  };
}
