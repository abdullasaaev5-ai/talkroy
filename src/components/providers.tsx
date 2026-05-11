"use client";

import { useEffect } from "react";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function ThemeProfileSync() {
  const { profile } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    const t = profile?.settings?.theme;
    if (t === "dark" || t === "light" || t === "system") {
      setTheme(t);
    }
  }, [profile?.settings?.theme, setTheme]);

  return null;
}

function Inner({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeProfileSync />
      {children}
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Inner>{children}</Inner>
      </AuthProvider>
    </ThemeProvider>
  );
}
