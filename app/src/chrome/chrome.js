const tabsEl = document.getElementById("tabs");
const newTabBtn = document.getElementById("newTabBtn");
const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
const reloadBtn = document.getElementById("reloadBtn");
const homeBtn = document.getElementById("homeBtn");
const addressInput = document.getElementById("addressInput");
const securityIndicator = document.getElementById("securityIndicator");
const starBtn = document.getElementById("starBtn");
const incognitoBtn = document.getElementById("incognitoBtn");
const progressBar = document.getElementById("progressBar");

const INCOGNITO_TAB_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" class="incognito-tab-icon"><path d="M3 13c1.5-4 4.5-6 9-6s7.5 2 9 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="7" cy="14.5" r="2.6" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="14.5" r="2.6" stroke="currentColor" stroke-width="1.8"/><path d="M9.6 14.5h4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const winMinimizeBtn = document.getElementById("winMinimizeBtn");
const winMaximizeBtn = document.getElementById("winMaximizeBtn");
const winCloseBtn = document.getElementById("winCloseBtn");

let currentTabs = [];
let bookmarkedUrls = new Set();
let addressBarFocused = false;

const RELOAD_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 1 3 6.7M3 12V6m0 6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const STOP_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>`;

/** Known search-result URL shapes → show only the query in the address bar. */
const SEARCH_RESULT_PATTERNS = [
  { host: /(^|\.)google\./i, path: /^\/search$/, param: "q" },
  { host: /(^|\.)bing\./i, path: /^\/search$/, param: "q" },
  { host: /(^|\.)duckduckgo\./i, path: /^\/$/, param: "q" },
];

function extractSearchQuery(url) {
  try {
    const u = new URL(url);
    const match = SEARCH_RESULT_PATTERNS.find(
      (p) => p.host.test(u.hostname) && p.path.test(u.pathname)
    );
    if (!match) return null;
    const q = u.searchParams.get(match.param);
    return q && q.trim() ? q : null;
  } catch {
    return null;
  }
}

function displayUrlForAddressBar(url) {
  if (!url || url.startsWith("attach://")) return "";
  const searchQuery = extractSearchQuery(url);
  if (searchQuery) return searchQuery;
  // Chrome-style: hide https:// (keep http:// so insecure pages stay obvious)
  return url.replace(/^https:\/\//i, "");
}

function activeTab() {
  return currentTabs.find((t) => t.active);
}

function renderTabs() {
  tabsEl.innerHTML = "";
  currentTabs.forEach((tab) => {
    const el = document.createElement("div");
    el.className = "tab" + (tab.active ? " active" : "") + (tab.isIncognito ? " incognito" : "");
    el.title = tab.url;
    el.innerHTML = `
      ${tab.isLoading ? '<div class="spinner"></div>' : tab.isIncognito ? INCOGNITO_TAB_ICON : ""}
      <span class="tab-title">${escapeHtml(tab.title || "New Tab")}</span>
      <span class="tab-close">&times;</span>
    `;
    el.addEventListener("click", (e) => {
      if (e.target.closest(".tab-close")) return;
      window.attach.tabs.activate(tab.id);
    });
    el.querySelector(".tab-close").addEventListener("click", (e) => {
      e.stopPropagation();
      window.attach.tabs.close(tab.id);
    });
    tabsEl.appendChild(el);
  });
}

function renderToolbar() {
  const tab = activeTab();
  if (!tab) return;

  backBtn.disabled = !tab.canGoBack;
  forwardBtn.disabled = !tab.canGoForward;
  reloadBtn.innerHTML = tab.isLoading ? STOP_ICON : RELOAD_ICON;
  reloadBtn.title = tab.isLoading ? "Stop" : "Reload (Ctrl+R)";

  if (!addressBarFocused) {
    addressInput.value = displayUrlForAddressBar(tab.url);
  }

  securityIndicator.classList.toggle("insecure", !tab.isSecure);
  progressBar.classList.toggle("loading", tab.isLoading);

  starBtn.classList.toggle("active", bookmarkedUrls.has(tab.url));
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function refreshBookmarks() {
  window.attach.bookmarks.list().then((list) => {
    bookmarkedUrls = new Set(list.map((b) => b.url));
    renderToolbar();
  });
}

window.attach.tabs.onUpdated((tabs) => {
  currentTabs = tabs;
  renderTabs();
  renderToolbar();
});

window.attach.tabs.list().then((tabs) => {
  currentTabs = tabs;
  renderTabs();
  renderToolbar();
  refreshBookmarks();
});

newTabBtn.addEventListener("click", () => window.attach.tabs.create());
incognitoBtn.addEventListener("click", () => window.attach.app.newIncognitoWindow());

// This window itself is an incognito window (chrome/index.html?incognito=1) —
// theme it distinctly and hide the "open another incognito window" action.
const isIncognitoWindow = new URLSearchParams(location.search).get("incognito") === "1";
if (isIncognitoWindow) {
  document.body.classList.add("incognito-window");
  incognitoBtn.style.display = "none";
}

backBtn.addEventListener("click", () => activeTab() && window.attach.nav.back(activeTab().id));
forwardBtn.addEventListener("click", () => activeTab() && window.attach.nav.forward(activeTab().id));
reloadBtn.addEventListener("click", () => {
  const tab = activeTab();
  if (!tab) return;
  tab.isLoading ? window.attach.nav.stop(tab.id) : window.attach.nav.reload(tab.id);
});
homeBtn.addEventListener("click", () => activeTab() && window.attach.nav.home(activeTab().id));

addressInput.addEventListener("focus", () => {
  addressBarFocused = true;
  const tab = activeTab();
  // Keep the clean query visible for search pages; only show full URL for normal sites.
  if (tab && tab.url && !extractSearchQuery(tab.url) && !tab.url.startsWith("attach://")) {
    addressInput.value = tab.url;
  }
  addressInput.select();
});
addressInput.addEventListener("blur", () => {
  addressBarFocused = false;
  renderToolbar();
});
addressInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const tab = activeTab();
  if (!tab || !addressInput.value.trim()) return;
  window.attach.nav.go(tab.id, addressInput.value.trim());
  addressBarFocused = false;
  addressInput.blur();
});

function toggleBookmark() {
  const tab = activeTab();
  if (!tab) return;
  if (bookmarkedUrls.has(tab.url)) {
    window.attach.bookmarks.list().then((list) => {
      const existing = list.find((b) => b.url === tab.url);
      if (existing) window.attach.bookmarks.remove(existing.id).then(refreshBookmarks);
    });
  } else {
    window.attach.bookmarks.add({ title: tab.title, url: tab.url }).then(refreshBookmarks);
  }
}

starBtn.addEventListener("click", toggleBookmark);
window.attach.onToggleBookmark(toggleBookmark);

window.attach.onFocusAddressBar(() => {
  addressInput.focus();
  addressInput.select();
});

// ---- Window controls (frame:false) ----
const MAXIMIZE_ICON = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1.2"/></svg>`;
const RESTORE_ICON = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="3.5" y="1.5" width="7" height="7" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 4.5v6h6" stroke="currentColor" stroke-width="1.2"/></svg>`;

function setMaximizeIcon(isMaximized) {
  winMaximizeBtn.innerHTML = isMaximized ? RESTORE_ICON : MAXIMIZE_ICON;
  winMaximizeBtn.title = isMaximized ? "Restore" : "Maximize";
}

winMinimizeBtn.addEventListener("click", () => window.attach.window.minimize());
winMaximizeBtn.addEventListener("click", () => window.attach.window.maximizeToggle());
winCloseBtn.addEventListener("click", () => window.attach.window.close());
window.attach.window.onMaximizedChanged(setMaximizeIcon);
window.attach.window.isMaximized().then(setMaximizeIcon);

// ---- Dropdown panels (VPN / profile / more menu) ----
// These no longer live in this document. They render in a dedicated,
// always-on-top WebContentsView (see panels.html/panels.js) that the main
// process positions to exactly cover the panel's own rectangle — so
// opening one never resizes, detaches, or blanks out the active tab.
// Clicking a toolbar icon here just asks main to show that panel; the
// panel closes itself (Escape, its own close button, or losing focus).
const vpnBtn = document.getElementById("vpnBtn");
const vpnDot = document.getElementById("vpnDot");
const profileIconBtn = document.getElementById("profileIconBtn");
const toolbarAvatarSlot = document.getElementById("toolbarAvatarSlot");
const moreBtn = document.getElementById("moreBtn");

vpnBtn.addEventListener("click", () => window.attach.ui.openPanel("vpn"));
profileIconBtn.addEventListener("click", () => window.attach.ui.openPanel("profile"));
moreBtn.addEventListener("click", () => window.attach.ui.openPanel("more"));

// Keep the toolbar's own VPN status dot and profile avatar in sync — the
// full panel detail rendering lives in panels.js now.
window.attach.vpn.onStatusUpdated((status) => {
  vpnDot.className = "vpn-dot" + (status.status === "connected" ? " connected" : status.status === "connecting" ? " connecting" : "");
});
window.attach.vpn.getStatus().then((status) => {
  vpnDot.className = "vpn-dot" + (status.status === "connected" ? " connected" : status.status === "connecting" ? " connecting" : "");
});

const DEFAULT_AVATAR_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="50" fill="#3b7cf6" />
  <circle cx="50" cy="34" r="21" fill="#2a2a2f" />
  <circle cx="50" cy="38" r="17" fill="#f2c19c" />
  <path d="M14,100 Q14,66 50,66 Q86,66 86,100 Z" fill="#e9e9ec" />
</svg>`;

function renderToolbarAvatar(profile) {
  if (profile && profile.picture) {
    toolbarAvatarSlot.innerHTML = `<img src="${escapeHtml(profile.picture)}" alt="" />`;
    return;
  }
  if (profile) {
    const initial = escapeHtml((profile.displayName || profile.email || "?")[0].toUpperCase());
    const color = profile.avatarColor || "#3b7cf6";
    toolbarAvatarSlot.innerHTML = `<div class="toolbar-avatar-initial" style="background:${escapeHtml(color)}">${initial}</div>`;
    return;
  }
  toolbarAvatarSlot.innerHTML = DEFAULT_AVATAR_SVG;
}
renderToolbarAvatar(null);
window.attach.profiles.getActive().then(renderToolbarAvatar);
window.attach.profiles.onActiveChanged(renderToolbarAvatar);
