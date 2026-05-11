"use client";

import { useCallback, useState } from "react";
import { adminApi } from "@/lib/admin";

export function useAdminStats() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      return await adminApi<Record<string, number>>("/api/admin/stats");
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { load, loading, error };
}
