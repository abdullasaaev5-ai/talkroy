"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin/stats", label: "Статистика" },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/monitor", label: "Слежка" },
  { href: "/admin/broadcast", label: "Рассылка" },
  { href: "/admin/chats", label: "Чаты" },
  { href: "/admin/moderators", label: "Модераторы" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 border-b border-white/10 bg-tr-panel px-4 py-3">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm transition",
            path === l.href
              ? "bg-tr-accent text-white"
              : "text-tr-muted hover:bg-white/5 hover:text-tr-text",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
