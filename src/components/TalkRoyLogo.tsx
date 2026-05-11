"use client";

import { cn } from "@/lib/utils";

/** Логотипы из design pack: `talkroy-logo.svg`, `talkroy-icon.svg` в `public/images/`. */
export function TalkRoyLogo({
  className,
  size = 40,
  variant = "icon",
  alt = "TalkRoy",
}: {
  className?: string;
  /** Для `icon` — сторона квадрата в px; для `wordmark` — высота блока в px (ширина авто). */
  size?: number;
  variant?: "icon" | "wordmark";
  alt?: string;
}) {
  if (variant === "wordmark") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/images/talkroy-logo.svg"
        alt={alt}
        className={cn(
          "h-auto w-auto max-w-[min(100%,320px)] object-contain object-left",
          className,
        )}
        style={{ height: size, width: "auto" }}
        draggable={false}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-lg shadow-violet-950/40 ring-1 ring-white/10",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/talkroy-icon.svg"
        alt={alt}
        width={size}
        height={size}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </div>
  );
}
