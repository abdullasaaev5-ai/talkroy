"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AdminNav } from "@/components/AdminPanel/AdminNav";
import { useAuth } from "@/hooks/useAuth";
import { useTalkRoyAdminClaim } from "@/hooks/useTalkRoyAdminClaim";

export function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { firebaseUser, loading, authResolved } = useAuth();
  const { adminOperator, adminClaimResolved } = useTalkRoyAdminClaim(
    firebaseUser,
    authResolved && !loading,
  );

  useEffect(() => {
    if (loading || !adminClaimResolved) return;
    if (!firebaseUser) {
      router.push("/login");
      return;
    }
    if (!adminOperator) router.push("/chat");
  }, [firebaseUser, adminOperator, adminClaimResolved, loading, router]);

  if (loading || !adminClaimResolved || !firebaseUser || !adminOperator) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tr-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-tr-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tr-bg">
      <header className="flex items-center gap-4 border-b border-white/10 bg-tr-panel px-4 py-3">
        <Link href="/chat" className="text-tr-muted hover:text-tr-text">
          ← Чаты
        </Link>
        <h1 className="text-lg font-bold text-tr-text">Админ-панель TalkRoy</h1>
      </header>
      <AdminNav />
      <div className="mx-auto max-w-6xl p-4">{children}</div>
    </div>
  );
}
