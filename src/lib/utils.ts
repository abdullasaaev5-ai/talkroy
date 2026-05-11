import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseUa(): { browser: string; device: string } {
  if (typeof navigator === "undefined") {
    return { browser: "unknown", device: "unknown" };
  }
  const ua = navigator.userAgent;
  let browser = "browser";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";
  else if (/Edg\//.test(ua)) browser = "Edge";

  let device = "desktop";
  if (/Mobi|Android/i.test(ua)) device = "mobile";
  if (/Windows/i.test(ua)) device = "Windows";
  else if (/Mac OS/i.test(ua)) device = "macOS";
  else if (/Linux/i.test(ua)) device = "Linux";
  else if (/Android/i.test(ua)) device = "Android";
  else if (/iPhone|iPad/i.test(ua)) device = "iOS";

  return { browser, device };
}
