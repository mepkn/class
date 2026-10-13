import { nanoid } from "nanoid";

const STORAGE_KEY = "class.voterToken";
let memoryToken: string | null = null;

/**
 * Anonymous, per-browser voter identity. Stored in localStorage so a new tab
 * gets the same token (and can't vote twice). Falls back to an in-memory token
 * when storage is unavailable (private mode, blocked cookies, ...).
 * The server's (pollId, voterToken) uniqueness check is the real protection.
 */
export function getVoterToken(): string {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh = nanoid();
    window.localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    memoryToken ??= nanoid();
    return memoryToken;
  }
}
