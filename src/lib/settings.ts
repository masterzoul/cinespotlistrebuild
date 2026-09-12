const CACHE_KEY = "lmd_my_snapshot";

function read(key: string) {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function write(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadSnapshot<T>(): { data: T; savedAt: number } | null {
  const raw = read(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { data: T; savedAt: number };
  } catch {
    return null;
  }
}

export function saveSnapshot<T>(data: T) {
  write(CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
}
