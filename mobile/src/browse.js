import { Capacitor, registerPlugin } from "@capacitor/core";

const VinaruBrowser = registerPlugin("VinaruBrowser");
const VinaruDownloads = registerPlugin("VinaruDownloads");
const VinaruLibrary = registerPlugin("VinaruLibrary");
const VinaruProfiles = registerPlugin("VinaruProfiles");

const LS_BOOKMARKS = "vinaru.bookmarks";
const LS_HISTORY = "vinaru.history";
const LS_PROFILES = "vinaru.profiles";
const LS_ACTIVE_PROFILE = "vinaru.activeProfileId";
const PROFILE_COLORS = ["#3b7cf6", "#ef4b4b", "#2ecc71", "#f2b807", "#9b59b6", "#1abc9c", "#e67e22"];

export function resolveInput(raw) {
  const input = (raw || "").trim();
  if (!input) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) return input;
  if (/^localhost(:\d+)?(\/.*)?$/i.test(input)) return "http://" + input;
  if (!/\s/.test(input) && /\.[a-zA-Z]{2,}(\/.*)?$/.test(input)) return "https://" + input;
  return "https://www.google.com/search?q=" + encodeURIComponent(input);
}

/** Open URL inside Vinaru (native WebView) — never hand off to Chrome/other browsers. */
export async function openUrl(url, { incognito = false, tabCount = 1 } = {}) {
  if (!url) return;

  if (!Capacitor.isNativePlatform()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  await VinaruBrowser.open({
    url,
    incognito: Boolean(incognito),
    tabCount: Math.max(1, Number(tabCount) || 1),
  });
}

export async function listDownloads() {
  if (!Capacitor.isNativePlatform()) return [];
  const result = await VinaruDownloads.list();
  return Array.isArray(result?.items) ? result.items : [];
}

export async function openDownload(id) {
  if (!Capacitor.isNativePlatform()) return;
  await VinaruDownloads.open({ id });
}

export async function openDownloadsFolder() {
  if (!Capacitor.isNativePlatform()) return;
  await VinaruDownloads.openFolder();
}

function readLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
}

export async function listBookmarks() {
  if (Capacitor.isNativePlatform()) {
    const result = await VinaruLibrary.listBookmarks();
    return Array.isArray(result?.items) ? result.items : [];
  }
  return readLocal(LS_BOOKMARKS);
}

export async function addBookmark(title, url) {
  if (!url) return null;
  if (Capacitor.isNativePlatform()) {
    return VinaruLibrary.addBookmark({ title, url });
  }
  const list = readLocal(LS_BOOKMARKS);
  const existing = list.find((b) => b.url === url);
  if (existing) return existing;
  const item = {
    id: `bm-${Date.now()}`,
    title: title || url,
    url,
    createdAt: Date.now(),
  };
  writeLocal(LS_BOOKMARKS, [item, ...list].slice(0, 200));
  return item;
}

export async function removeBookmark(id) {
  if (Capacitor.isNativePlatform()) {
    await VinaruLibrary.removeBookmark({ id });
    return;
  }
  writeLocal(
    LS_BOOKMARKS,
    readLocal(LS_BOOKMARKS).filter((b) => b.id !== id)
  );
}

export async function isBookmarked(url) {
  if (!url) return false;
  if (Capacitor.isNativePlatform()) {
    const result = await VinaruLibrary.isBookmarked({ url });
    return Boolean(result?.bookmarked);
  }
  return readLocal(LS_BOOKMARKS).some((b) => b.url === url);
}

export async function listHistory(query = "") {
  if (Capacitor.isNativePlatform()) {
    const result = await VinaruLibrary.listHistory({ query });
    return Array.isArray(result?.items) ? result.items : [];
  }
  const q = (query || "").trim().toLowerCase();
  const list = readLocal(LS_HISTORY);
  if (!q) return list;
  return list.filter(
    (h) => (h.title || "").toLowerCase().includes(q) || (h.url || "").toLowerCase().includes(q)
  );
}

export async function recordHistory(title, url) {
  if (!url) return;
  if (Capacitor.isNativePlatform()) {
    await VinaruLibrary.recordHistory({ title, url });
    return;
  }
  const list = readLocal(LS_HISTORY);
  const idx = list.findIndex((h) => h.url === url);
  const now = Date.now();
  if (idx >= 0) {
    const item = {
      ...list[idx],
      title: title || list[idx].title || url,
      visitedAt: now,
      visitCount: (list[idx].visitCount || 1) + 1,
    };
    const next = [item, ...list.filter((_, i) => i !== idx)].slice(0, 200);
    writeLocal(LS_HISTORY, next);
  } else {
    writeLocal(
      LS_HISTORY,
      [{ id: `hi-${now}`, title: title || url, url, visitedAt: now, visitCount: 1 }, ...list].slice(0, 200)
    );
  }
}

export async function removeHistory(id) {
  if (Capacitor.isNativePlatform()) {
    await VinaruLibrary.removeHistory({ id });
    return;
  }
  writeLocal(
    LS_HISTORY,
    readLocal(LS_HISTORY).filter((h) => h.id !== id)
  );
}

export async function clearHistory(mode = "all") {
  if (Capacitor.isNativePlatform()) {
    await VinaruLibrary.clearHistory({ mode });
    return;
  }
  if (mode === "all") {
    writeLocal(LS_HISTORY, []);
    return;
  }
  const windowMs = mode === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - windowMs;
  writeLocal(
    LS_HISTORY,
    readLocal(LS_HISTORY).filter((h) => (h.visitedAt || 0) >= cutoff)
  );
}

export async function listProfiles() {
  if (Capacitor.isNativePlatform()) {
    const result = await VinaruProfiles.list();
    return Array.isArray(result?.items) ? result.items : [];
  }
  return readLocal(LS_PROFILES);
}

export async function getActiveProfile() {
  if (Capacitor.isNativePlatform()) {
    const result = await VinaruProfiles.getActive();
    return result?.id ? result : null;
  }
  const activeId = localStorage.getItem(LS_ACTIVE_PROFILE);
  if (!activeId) return null;
  return readLocal(LS_PROFILES).find((p) => p.id === activeId) || null;
}

export async function createProfile(displayName) {
  const name = (displayName || "").trim();
  if (!name) throw new Error("Name is required");
  if (Capacitor.isNativePlatform()) {
    return VinaruProfiles.create({ displayName: name });
  }
  const list = readLocal(LS_PROFILES);
  const item = {
    id: `pf-${Date.now()}`,
    type: "guest",
    displayName: name,
    email: "",
    avatarColor: PROFILE_COLORS[list.length % PROFILE_COLORS.length],
    createdAt: Date.now(),
    signedOut: false,
  };
  writeLocal(LS_PROFILES, [item, ...list]);
  localStorage.setItem(LS_ACTIVE_PROFILE, item.id);
  return item;
}

export async function saveAccountProfile(account) {
  const email = (account?.email || "").trim().toLowerCase();
  if (!email) throw new Error("email is required");
  const payload = {
    id: account.id || `local-${email}`,
    type: account.type || "local",
    email,
    displayName: account.displayName || email,
    avatarColor: account.avatarColor || PROFILE_COLORS[0],
    picture: account.picture || "",
    accessToken: account.accessToken || "",
    refreshToken: account.refreshToken || "",
    createdAt: account.createdAt || Date.now(),
  };
  if (Capacitor.isNativePlatform()) {
    return VinaruProfiles.saveAccount(payload);
  }
  const list = readLocal(LS_PROFILES).filter(
    (p) => p.id !== payload.id && (p.email || "").toLowerCase() !== email
  );
  const item = { ...payload, signedOut: false };
  writeLocal(LS_PROFILES, [item, ...list]);
  localStorage.setItem(LS_ACTIVE_PROFILE, item.id);
  return item;
}

export async function setActiveProfile(id) {
  if (Capacitor.isNativePlatform()) {
    const result = await VinaruProfiles.setActive({ id });
    return result?.id ? result : null;
  }
  if (!id) {
    localStorage.removeItem(LS_ACTIVE_PROFILE);
    return null;
  }
  const item = readLocal(LS_PROFILES).find((p) => p.id === id) || null;
  if (item) localStorage.setItem(LS_ACTIVE_PROFILE, id);
  return item;
}

export async function clearActiveProfile() {
  if (Capacitor.isNativePlatform()) {
    await VinaruProfiles.clearActive();
    return;
  }
  localStorage.removeItem(LS_ACTIVE_PROFILE);
}

export async function removeProfile(id) {
  if (Capacitor.isNativePlatform()) {
    await VinaruProfiles.remove({ id });
    return;
  }
  const next = readLocal(LS_PROFILES).filter((p) => p.id !== id);
  writeLocal(LS_PROFILES, next);
  if (localStorage.getItem(LS_ACTIVE_PROFILE) === id) {
    if (next[0]) localStorage.setItem(LS_ACTIVE_PROFILE, next[0].id);
    else localStorage.removeItem(LS_ACTIVE_PROFILE);
  }
}

export async function closeBrowser() {
  // BrowserActivity is closed with its Home / system back when history is empty.
}
