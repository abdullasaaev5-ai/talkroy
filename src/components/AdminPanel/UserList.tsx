"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeAllUsers } from "@/lib/firestore";
import type { UserDoc } from "@/types";
import { auth } from "@/lib/firebase";

async function action(payload: { action: string; targetUid: string }) {
  const u = auth.currentUser;
  if (!u) return;
  const token = await u.getIdToken();
  await fetch("/api/admin/user-action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function UserList({ moderatorTab }: { moderatorTab?: boolean }) {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    return subscribeAllUsers(setUsers);
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let list = users;
    if (moderatorTab) list = list.filter((u) => u.role === "moderator");
    if (!t) return list;
    return list.filter(
      (u) =>
        u.displayName.toLowerCase().includes(t) ||
        u.usernameLower.includes(t) ||
        (u.email ?? "").toLowerCase().includes(t),
    );
  }, [users, q, moderatorTab]);

  return (
    <div className="flex flex-col gap-4">
      <input
        className="rounded-xl border border-white/10 bg-tr-panel px-3 py-2 text-tr-text"
        placeholder="Поиск по имени / @username / email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-tr-panel text-tr-muted">
            <tr>
              <th className="p-3">Пользователь</th>
              <th className="p-3">Email</th>
              <th className="p-3">Регистрация</th>
              <th className="p-3">Онлайн</th>
              <th className="p-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.uid} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="flex items-center gap-2 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u.photoURL || "/images/icon.svg"}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-medium text-tr-text">
                      {u.displayName}{" "}
                      {u.isVerified && (
                        <span className="text-sky-400" title="verified">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="text-tr-muted">{u.username}</div>
                  </div>
                </td>
                <td className="p-3 text-tr-muted">{u.email ?? "—"}</td>
                <td className="p-3 text-tr-muted">
                  {u.createdAt?.toDate?.().toLocaleDateString?.() ?? "—"}
                </td>
                <td className="p-3 text-tr-muted">
                  {u.lastSeen?.toDate?.().toLocaleString?.() ?? "—"}
                </td>
                <td className="flex flex-wrap gap-1 p-3">
                  {!u.isSystem && (
                    <>
                      <button
                        type="button"
                        className="rounded bg-tr-card px-2 py-1 text-xs text-tr-text hover:bg-white/10"
                        onClick={() =>
                          action({
                            action: u.isBlocked ? "unblock" : "block",
                            targetUid: u.uid,
                          })
                        }
                      >
                        {u.isBlocked ? "Разблок." : "Блок"}
                      </button>
                      <button
                        type="button"
                        className="rounded bg-tr-card px-2 py-1 text-xs text-tr-text hover:bg-white/10"
                        onClick={() =>
                          action({ action: "verify", targetUid: u.uid })
                        }
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className="rounded bg-tr-card px-2 py-1 text-xs text-tr-text hover:bg-white/10"
                        onClick={() =>
                          action({
                            action:
                              u.role === "moderator" ? "unmoderator" : "moderator",
                            targetUid: u.uid,
                          })
                        }
                      >
                        Мод.
                      </button>
                      <button
                        type="button"
                        className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30"
                        onClick={() => {
                          if (
                            confirm(
                              `Удалить пользователя ${u.username} навсегда?`,
                            )
                          )
                            action({ action: "delete", targetUid: u.uid });
                        }}
                      >
                        Удалить
                      </button>
                    </>
                  )}
                  {u.isSystem && (
                    <span className="text-xs text-tr-muted">system</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
