const { contextBridge, ipcRenderer } = require("electron");

// This preload runs both in the chrome UI shell (file://.../chrome/index.html)
// and inside every tab's WebContentsView (arbitrary websites + internal
// attach:// pages). Only expose the privileged API to our own pages so
// untrusted websites never get access to bookmarks/history/downloads/settings.
const isChromeShell = location.pathname.endsWith("/chrome/index.html");
const isPanelsShell = location.pathname.endsWith("/chrome/panels.html");
const isInternalPage = location.protocol === "attach:";

if (isChromeShell || isPanelsShell || isInternalPage) {
  contextBridge.exposeInMainWorld("attach", {
  tabs: {
    create: (url) => ipcRenderer.invoke("tab:create", url),
    close: (id) => ipcRenderer.invoke("tab:close", id),
    activate: (id) => ipcRenderer.invoke("tab:activate", id),
    list: () => ipcRenderer.invoke("tab:list"),
    onUpdated: (cb) => ipcRenderer.on("tabs:updated", (_e, tabs) => cb(tabs)),
  },
  nav: {
    go: (tabId, input) => ipcRenderer.invoke("nav:go", { tabId, input }),
    back: (tabId) => ipcRenderer.invoke("nav:back", tabId),
    forward: (tabId) => ipcRenderer.invoke("nav:forward", tabId),
    reload: (tabId) => ipcRenderer.invoke("nav:reload", tabId),
    stop: (tabId) => ipcRenderer.invoke("nav:stop", tabId),
    home: (tabId) => ipcRenderer.invoke("nav:home", tabId),
    goSelf: (input) => ipcRenderer.invoke("nav:go-self", input),
  },
  bookmarks: {
    list: () => ipcRenderer.invoke("bookmarks:list"),
    add: (bookmark) => ipcRenderer.invoke("bookmarks:add", bookmark),
    remove: (id) => ipcRenderer.invoke("bookmarks:remove", id),
  },
  history: {
    list: (query) => ipcRenderer.invoke("history:list", query),
    removeEntry: (id) => ipcRenderer.invoke("history:removeEntry", id),
    clear: (range) => ipcRenderer.invoke("history:clear", range),
  },
  downloads: {
    list: () => ipcRenderer.invoke("downloads:list"),
    openFile: (id) => ipcRenderer.invoke("downloads:openFile", id),
    openFolder: (id) => ipcRenderer.invoke("downloads:openFolder", id),
    onUpdated: (cb) => ipcRenderer.on("downloads:updated", (_e, list) => cb(list)),
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (partial) => ipcRenderer.invoke("settings:set", partial),
  },
  auth: {
    getProfile: () => ipcRenderer.invoke("auth:get-profile"),
    signIn: () => ipcRenderer.invoke("auth:sign-in"),
    signOut: () => ipcRenderer.invoke("auth:sign-out"),
  },
  profiles: {
    list: () => ipcRenderer.invoke("profiles:list"),
    getActive: () => ipcRenderer.invoke("profiles:get-active"),
    checkEmail: (email) => ipcRenderer.invoke("profiles:check-email", email),
    sendOtp: (mobile) => ipcRenderer.invoke("profiles:send-otp", mobile),
    verifyOtp: (mobile, code) => ipcRenderer.invoke("profiles:verify-otp", { mobile, code }),
    register: (email, password, displayName, dob, mobile) =>
      ipcRenderer.invoke("profiles:register", { email, password, displayName, dob, mobile }),
    login: (email, password) => ipcRenderer.invoke("profiles:login", { email, password }),
    remove: (id) => ipcRenderer.invoke("profiles:remove", id),
    setActive: (id) => ipcRenderer.invoke("profiles:set-active", id),
    clearActive: () => ipcRenderer.invoke("profiles:clear-active"),
    onActiveChanged: (cb) => ipcRenderer.on("profiles:active-changed", (_e, profile) => cb(profile)),
  },
  vpn: {
    listServers: () => ipcRenderer.invoke("vpn:list-servers"),
    connect: (serverId) => ipcRenderer.invoke("vpn:connect", serverId),
    disconnect: () => ipcRenderer.invoke("vpn:disconnect"),
    getStatus: () => ipcRenderer.invoke("vpn:get-status"),
    setKillSwitch: (enabled) => ipcRenderer.invoke("vpn:set-kill-switch", enabled),
    getPrivacySettings: () => ipcRenderer.invoke("vpn:get-privacy-settings"),
    setPrivacySettings: (partial) => ipcRenderer.invoke("vpn:set-privacy-settings", partial),
    onStatusUpdated: (cb) => ipcRenderer.on("vpn:status-updated", (_e, status) => cb(status)),
  },
  app: {
    newIncognitoWindow: () => ipcRenderer.invoke("app:new-incognito-window"),
  },
  ui: {
    openPanel: (name) => ipcRenderer.invoke("ui:open-panel", name),
    closePanel: () => ipcRenderer.invoke("ui:close-panel"),
    reportPanelSize: (width, height) => ipcRenderer.invoke("ui:report-panel-size", { width, height }),
    onShowPanel: (cb) => ipcRenderer.on("panel:show", (_e, name) => cb(name)),
  },
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximizeToggle: () => ipcRenderer.invoke("window:maximize-toggle"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
    onMaximizedChanged: (cb) => ipcRenderer.on("window:maximized-changed", (_e, isMaximized) => cb(isMaximized)),
  },
  onFocusAddressBar: (cb) => ipcRenderer.on("shortcut:focus-address-bar", cb),
  onToggleBookmark: (cb) => ipcRenderer.on("shortcut:toggle-bookmark", cb),
  });
}
