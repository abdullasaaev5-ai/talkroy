"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ThemeMode = "dark" | "light" | "system";

type ThemeCtx = {
  theme: ThemeMode;
  resolved: "dark" | "light";
  setTheme: (t: ThemeMode) => void;
  toggleLightDark: () => void;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = "talkroy_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [resolved, setResolved] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored === "dark" || stored === "light" || stored === "system") {
      setThemeState(stored);
    }
  }, []);

  const applyResolved = useCallback((mode: ThemeMode) => {
    const sys =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    const r = mode === "system" ? sys : mode;
    setResolved(r);
    document.documentElement.classList.toggle("dark", r === "dark");
  }, []);

  useEffect(() => {
    applyResolved(theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => {
      if (theme === "system") applyResolved("system");
    };
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [theme, applyResolved]);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyResolved(t);
  }, [applyResolved]);

  const toggleLightDark = useCallback(() => {
    const next = resolved === "dark" ? "light" : "dark";
    setTheme(next);
  }, [resolved, setTheme]);

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggleLightDark }),
    [theme, resolved, setTheme, toggleLightDark],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme outside ThemeProvider");
  return ctx;
}
