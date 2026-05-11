"use client";

import { TalkRoyLogo } from "@/components/TalkRoyLogo";

const demoThreads = [
  {
    name: "Мама",
    preview: "Ужин в 19:00 ❤️",
    time: "18:42",
    dot: "bg-emerald-400",
  },
  {
    name: "Команда TalkRoy",
    preview: "Релиз готов к выкладке",
    time: "17:05",
    dot: "bg-violet-400",
  },
  {
    name: "TalkRoy",
    preview: "Добро пожаловать в мессенджер!",
    time: "Вчера",
    dot: "bg-violet-500",
    logo: true,
  },
];

/**
 * Статичный макет чата для лендинга — без Firebase и без входа.
 */
export function LandingDemoChat() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#2d2d4a] bg-[#0a0a12] shadow-2xl shadow-black/50 ring-1 ring-white/[0.04]">
      <div className="flex items-center gap-2 border-b border-[#2d2d4a] bg-[#131325] px-3 py-2.5">
        <TalkRoyLogo size={30} />
        <span className="text-sm font-semibold text-white">TalkRoy</span>
        <span className="ml-auto rounded-full bg-[#1e1e3a] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#94a3b8]">
          демо
        </span>
      </div>

      <div className="flex h-[min(380px,52vh)] min-h-[320px] md:h-[420px]">
        <aside className="hidden w-[42%] shrink-0 flex-col border-r border-[#2d2d4a] bg-[#0f0f1a] sm:flex">
          <div className="border-b border-[#2d2d4a]/80 px-2 py-2">
            <div className="rounded-lg bg-[#1a1a2e] px-2 py-1.5 text-[11px] text-[#64748b]">
              Поиск чатов…
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-0.5 overflow-hidden p-1.5">
            {demoThreads.map((t, i) => (
              <div
                key={t.name}
                className={`flex cursor-default gap-2 rounded-xl px-2 py-2 ${
                  i === 2
                    ? "bg-[#1e1e3a] ring-1 ring-[#7c3aed]/40"
                    : "hover:bg-[#151525]"
                }`}
              >
                {t.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/images/talkroy-avatar.png"
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className={`h-10 w-10 shrink-0 rounded-full ${t.dot} opacity-90`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="truncate text-xs font-semibold text-[#e2e8f0]">
                      {t.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-[#64748b]">
                      {t.time}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-[#94a3b8]">{t.preview}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[#131325]">
          <div className="flex items-center gap-2 border-b border-[#2d2d4a] px-3 py-2 sm:hidden">
            <TalkRoyLogo size={28} />
            <span className="truncate text-xs font-medium text-[#e2e8f0]">
              TalkRoy
            </span>
          </div>
          <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden p-3">
            <div className="mb-1 flex gap-1 px-1">
              <span className="inline-flex h-2 w-2 animate-bounce rounded-full bg-[#94a3b8] [animation-delay:0ms]" />
              <span className="inline-flex h-2 w-2 animate-bounce rounded-full bg-[#94a3b8] [animation-delay:150ms]" />
              <span className="inline-flex h-2 w-2 animate-bounce rounded-full bg-[#94a3b8] [animation-delay:300ms]" />
            </div>
            <div className="mr-10 max-w-[92%] rounded-2xl rounded-bl-md border border-white/5 bg-[#1e293b] px-3 py-2 text-xs leading-relaxed text-[#e2e8f0] shadow-sm">
              Привет! Это демо-переписка — так выглядят сообщения в TalkRoy.
            </div>
            <div className="ml-10 max-w-[92%] self-end rounded-2xl rounded-br-md bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-3 py-2 text-xs leading-relaxed text-white shadow-md">
              Отлично, интерфейс понятный и быстрый ⚡
            </div>
            <div className="mr-10 max-w-[92%] rounded-2xl rounded-bl-md border border-white/5 bg-[#1e293b] px-3 py-2 text-xs leading-relaxed text-[#e2e8f0]">
              Можно отправлять фото, файлы и голосовые — после входа в аккаунт.
            </div>
          </div>
          <div className="border-t border-[#2d2d4a] bg-[#0f0f1a] px-3 py-2">
            <div className="flex items-center gap-2 rounded-xl border border-[#2d2d4a] bg-[#131325] px-3 py-2 text-[11px] text-[#64748b]">
              <span className="flex-1">Сообщение…</span>
              <span className="rounded-lg bg-[#7c3aed]/30 px-2 py-0.5 text-[10px] text-violet-200">
                отправить
              </span>
            </div>
          </div>
        </section>
      </div>

      <p className="border-t border-[#2d2d4a] bg-[#0f0f1a] px-3 py-2 text-center text-[10px] text-[#64748b]">
        Визуальный превью — без регистрации и без реальных сообщений
      </p>
    </div>
  );
}
