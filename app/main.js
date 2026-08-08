const { app, BrowserWindow, WebContentsView, Menu, ipcMain, protocol, shell, session, net, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const http = require("http");
const Store = require("electron-store");
const { createVpnManager } = require("./vpn/vpnManager");
const { applyPrivacySettings, applyWebRTCPolicy } = require("./vpn/privacy");

// Windows taskbar / Jump List: without this, Electron often shows the default icon.
if (process.platform === "win32") {
  app.setAppUserModelId("com.vinaru.browser");
}

function resolveAppIcon() {
  const names = process.platform === "win32" ? ["icon.ico", "icon.png"] : ["icon.png", "icon.ico"];
  const bases = [
    path.join(__dirname, "build"),
    path.join(__dirname.replace("app.asar", "app.asar.unpacked"), "build"),
  ];
  for (const base of bases) {
    for (const name of names) {
      const candidate = path.join(base, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

function loadAppIconImage() {
  const iconPath = resolveAppIcon();
  if (!iconPath) return undefined;
  const image = nativeImage.createFromPath(iconPath);
  return image.isEmpty() ? undefined : image;
}

let googleOAuthConfig = null;
try {
  googleOAuthConfig = require("./google-oauth.json");
} catch {
  googleOAuthConfig = null;
}

const TOOLBAR_HEIGHT = 84;
const ACCOUNTS_BACKEND_URL = process.env.VINARU_ACCOUNTS_BACKEND || "http://localhost:4200";

// Shared for the app's lifetime so incognito windows keep cookies/logins
// between each other (matching how a real incognito window behaves), but the
// partition name has no "persist:" prefix, so Electron keeps it in memory
// only — nothing is ever written to disk, and it's gone on app restart.
const INCOGNITO_PARTITION = "vinaru-incognito";

const store = new Store({
  defaults: {
    bookmarks: [],
    history: [],
    settings: {
      homepage: "attach://app/newtab.html",
      searchEngine: "google",
      theme: "dark",
    },
    vpnPrivacySettings: {
      webrtcLeakProtection: true,
      dnsOverHttps: true,
      trackerBlocking: true,
      httpsOnly: false,
    },
  },
});

const SEARCH_ENGINES = {
  google: "https://www.google.com/search?q=",
  bing: "https://www.bing.com/search?q=",
  duckduckgo: "https://duckduckgo.com/?q=",
};

protocol.registerSchemesAsPrivileged([
  { scheme: "attach", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

/** @type {Set<{window: BrowserWindow, tabs: Map<string, object>, activeTabId: string|null, isIncognito: boolean}>} */
const windowContexts = new Set();
/** @type {Map<string, {id: string, filename: string, url: string, savePath: string, state: string, receivedBytes: number, totalBytes: number}>} */
const downloads = new Map();

function createContext(isIncognito) {
  return { window: null, tabs: new Map(), activeTabId: null, isIncognito, closedTabsStack: [], spareTab: null, overlayView: null, overlayPanelSize: null };
}

// Spinning up a fresh sandboxed renderer process is the expensive part of
// opening a new tab (often 2s+ on this machine). Pre-create one pointed at
// the homepage in the background so it's already warm by the time the user
// actually clicks "+" — createTab() promotes it instead of starting cold.
function prewarmSpareTab(ctx) {
  if (ctx.isIncognito || ctx.spareTab) return;
  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
    },
  });
  view.webContents.loadURL(store.get("settings").homepage);
  ctx.spareTab = view;
}

function contextForSenderId(webContentsId) {
  for (const ctx of windowContexts) {
    if (ctx.window && ctx.window.webContents.id === webContentsId) return ctx;
    if (ctx.overlayView && ctx.overlayView.webContents.id === webContentsId) return ctx;
    for (const tab of ctx.tabs.values()) {
      if (tab.view.webContents.id === webContentsId) return ctx;
    }
  }
  return undefined;
}

function findTab(tabId) {
  for (const ctx of windowContexts) {
    const tab = ctx.tabs.get(tabId);
    if (tab) return { ctx, tab };
  }
  return undefined;
}

function findTabBySenderId(webContentsId) {
  for (const ctx of windowContexts) {
    for (const [id, tab] of ctx.tabs) {
      if (tab.view.webContents.id === webContentsId) return { ctx, id, tab };
    }
  }
  return undefined;
}

function base64url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isGoogleOAuthConfigured() {
  return Boolean(
    googleOAuthConfig &&
      googleOAuthConfig.clientId &&
      googleOAuthConfig.clientSecret &&
      !googleOAuthConfig.clientId.includes("YOUR_")
  );
}

function signInWithGoogle() {
  return new Promise((resolve, reject) => {
    if (!isGoogleOAuthConfigured()) {
      reject(
        new Error(
          "Google sign-in isn't configured yet. Add your OAuth Client ID/Secret to app/google-oauth.json."
        )
      );
      return;
    }

    const codeVerifier = base64url(crypto.randomBytes(32));
    const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
    const state = base64url(crypto.randomBytes(16));
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      server.close();
      reject(new Error("Sign-in timed out"));
    }, 120000);

    const server = http.createServer(async (req, res) => {
      const requestUrl = new URL(req.url, "http://127.0.0.1");
      if (requestUrl.pathname !== "/oauth/callback") {
        res.writeHead(404).end();
        return;
      }

      const code = requestUrl.searchParams.get("code");
      const returnedState = requestUrl.searchParams.get("state");
      const error = requestUrl.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<!doctype html><html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
          background:#0b0b0d;color:#f5f5f5;font-family:sans-serif;">
          <p>Signed in. You can close this tab and return to Vinaru.</p>
        </body></html>`
      );

      if (settled) return;
      clearTimeout(timeoutId);
      server.close();

      if (error || !code || returnedState !== state) {
        settled = true;
        reject(new Error(error || "Sign-in was cancelled or invalid"));
        return;
      }

      try {
        const port = server.address().port;
        const redirectUri = `http://127.0.0.1:${port}/oauth/callback`;

        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: googleOAuthConfig.clientId,
            client_secret: googleOAuthConfig.clientSecret,
            code,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
          }),
        });
        const tokens = await tokenRes.json();
        if (!tokens.access_token) throw new Error(tokens.error_description || "Token exchange failed");

        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const profile = await userRes.json();

        const account = {
          name: profile.name || profile.email,
          email: profile.email,
          picture: profile.picture || null,
          signedInAt: Date.now(),
        };
        store.set("account", account);
        settled = true;
        resolve(account);
      } catch (e) {
        settled = true;
        reject(e);
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}/oauth/callback`;
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", googleOAuthConfig.clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid email profile");
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      authUrl.searchParams.set("state", state);
      shell.openExternal(authUrl.toString());
    });
  });
}

function resolveInput(rawInput) {
  const input = rawInput.trim();
  if (!input) return null;
  if (/^attach:\/\//i.test(input)) return input;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) return input;
  if (/^localhost(:\d+)?(\/.*)?$/i.test(input)) return "http://" + input;
  if (!/\s/.test(input) && /\.[a-zA-Z]{2,}(\/.*)?$/.test(input)) return "https://" + input;
  const engine = SEARCH_ENGINES[store.get("settings").searchEngine] || SEARCH_ENGINES.google;
  return engine + encodeURIComponent(input);
}

function sendToChrome(ctx, channel, payload) {
  if (ctx && ctx.window && !ctx.window.isDestroyed()) {
    ctx.window.webContents.send(channel, payload);
  }
  if (ctx && ctx.overlayView && !ctx.overlayView.webContents.isDestroyed()) {
    ctx.overlayView.webContents.send(channel, payload);
  }
}

function broadcastToAll(channel, payload) {
  for (const ctx of windowContexts) sendToChrome(ctx, channel, payload);
}

const vpnManager = createVpnManager(store, broadcastToAll);

function serializeTabs(ctx) {
  return Array.from(ctx.tabs.entries()).map(([id, tab]) => ({
    id,
    title: tab.title || "New Tab",
    url: tab.url,
    isLoading: tab.isLoading,
    canGoBack: tab.canGoBack,
    canGoForward: tab.canGoForward,
    isSecure: tab.url.startsWith("https://"),
    active: id === ctx.activeTabId,
    isIncognito: Boolean(tab.isIncognito),
  }));
}

function broadcastTabs(ctx) {
  sendToChrome(ctx, "tabs:updated", serializeTabs(ctx));
}

function layoutActiveView(ctx) {
  if (!ctx.window || !ctx.activeTabId) return;
  const tab = ctx.tabs.get(ctx.activeTabId);
  if (!tab) return;
  const bounds = ctx.window.getContentBounds();
  tab.view.setBounds({
    x: 0,
    y: TOOLBAR_HEIGHT,
    width: bounds.width,
    height: Math.max(0, bounds.height - TOOLBAR_HEIGHT),
  });
}

// Dropdown panels (VPN/profile/more menu) render in their own dedicated
// WebContentsView (see panels.html/panels.js), positioned to exactly cover
// the panel's own rectangle in the top-right corner and added on top of
// the active tab's view. The tab itself is never resized or detached, so
// the page underneath is always fully visible — opening a panel just
// occludes that one small corner, like a real browser dropdown.
const PANEL_RIGHT_MARGIN = 12;

function positionOverlayPanel(ctx, width, height) {
  if (!ctx.window || !ctx.overlayView) return;
  const bounds = ctx.window.getContentBounds();
  const x = Math.max(0, bounds.width - PANEL_RIGHT_MARGIN - width);
  const y = TOOLBAR_HEIGHT;
  const clampedHeight = Math.max(0, Math.min(height, bounds.height - y));
  ctx.overlayView.setBounds({ x, y, width, height: clampedHeight });
}

function closeOverlayPanel(ctx) {
  if (!ctx.overlayView) return;
  ctx.overlayPanelSize = null;
  ctx.overlayView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  if (!ctx.overlayView.webContents.isDestroyed()) {
    ctx.overlayView.webContents.send("panel:show", null);
  }
}

function recordVisit(url, title) {
  if (!url || url.startsWith("attach://") || url.startsWith("data:")) return;
  const history = store.get("history");
  const existing = history.find((entry) => entry.url === url);
  if (existing) {
    existing.title = title || existing.title;
    existing.visitedAt = Date.now();
    existing.visitCount += 1;
  } else {
    history.unshift({
      id: crypto.randomUUID(),
      url,
      title: title || url,
      visitedAt: Date.now(),
      visitCount: 1,
    });
  }
  store.set("history", history.slice(0, 5000));
}

function attachViewEvents(ctx, id, view) {
  const wc = view.webContents;

  wc.on("did-start-loading", () => {
    const tab = ctx.tabs.get(id);
    if (!tab) return;
    tab.isLoading = true;
    broadcastTabs(ctx);
  });

  wc.on("did-stop-loading", () => {
    const tab = ctx.tabs.get(id);
    if (!tab) return;
    tab.isLoading = false;
    tab.canGoBack = wc.navigationHistory.canGoBack();
    tab.canGoForward = wc.navigationHistory.canGoForward();
    broadcastTabs(ctx);
  });

  wc.on("did-navigate", (_event, url) => {
    const tab = ctx.tabs.get(id);
    if (!tab) return;
    tab.url = url;
    broadcastTabs(ctx);
    if (!tab.isIncognito) recordVisit(url, tab.title);
  });

  wc.on("did-navigate-in-page", (_event, url) => {
    const tab = ctx.tabs.get(id);
    if (!tab) return;
    tab.url = url;
    broadcastTabs(ctx);
  });

  wc.on("page-title-updated", (_event, title) => {
    const tab = ctx.tabs.get(id);
    if (!tab) return;
    tab.title = title;
    broadcastTabs(ctx);
    if (!tab.isIncognito) recordVisit(tab.url, title);
  });

  wc.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (errorCode === -3 || !isMainFrame) return; // aborted / iframe, ignore
    const tab = ctx.tabs.get(id);
    if (!tab) return;
    const safeUrl = JSON.stringify(validatedURL || tab.url);
    const safeDesc = JSON.stringify(errorDescription || "Unknown error");
    wc.loadURL(
      "data:text/html," +
        encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><style>
          body{background:#0b0b0d;color:#f5f5f5;font-family:-apple-system,Segoe UI,sans-serif;
            display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}
          h1{font-size:22px;margin-bottom:8px}p{color:#9a9aa3;font-size:14px;margin-bottom:20px}
          code{color:#7a7a82}button{background:#3b7cf6;color:#fff;border:none;padding:10px 20px;
            border-radius:999px;font-weight:600;cursor:pointer;font-size:14px}
        </style></head><body>
          <h1>This page can't be reached</h1>
          <p>${safeDesc.slice(1, -1)}<br/><code>${safeUrl.slice(1, -1)}</code></p>
          <button onclick="location.reload()">Retry</button>
        </body></html>`)
    );
  });

  wc.setWindowOpenHandler(({ url }) => {
    createTab(ctx, url);
    return { action: "deny" };
  });
}

function createTab(ctx, rawUrl, options = {}) {
  const isIncognito = options.incognito ?? ctx.isIncognito;
  const target = resolveInput(rawUrl || store.get("settings").homepage) || store.get("settings").homepage;
  const id = crypto.randomUUID();

  const canUseSpare = !isIncognito && ctx.spareTab && target === store.get("settings").homepage;
  let view;
  if (canUseSpare) {
    view = ctx.spareTab;
    ctx.spareTab = null;
    prewarmSpareTab(ctx); // immediately start warming the next one
  } else {
    view = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        sandbox: true,
        session: isIncognito ? session.fromPartition(INCOGNITO_PARTITION, { cache: false }) : undefined,
      },
    });
    view.webContents.loadURL(target);
  }

  ctx.tabs.set(id, {
    view,
    title: view.webContents.getTitle() || "New Tab",
    url: target,
    isLoading: view.webContents.isLoading(),
    canGoBack: view.webContents.navigationHistory.canGoBack(),
    canGoForward: view.webContents.navigationHistory.canGoForward(),
    isIncognito,
  });
  attachViewEvents(ctx, id, view);
  applyWebRTCPolicy(view.webContents, store.get("vpnPrivacySettings"));
  registerShortcuts(view.webContents, ctx);
  activateTab(ctx, id);
  return id;
}

function activateTab(ctx, id) {
  const tab = ctx.tabs.get(id);
  if (!tab || !ctx.window) return;
  if (ctx.activeTabId && ctx.tabs.has(ctx.activeTabId) && ctx.activeTabId !== id) {
    ctx.window.contentView.removeChildView(ctx.tabs.get(ctx.activeTabId).view);
  }
  ctx.activeTabId = id;
  ctx.window.contentView.addChildView(tab.view);
  layoutActiveView(ctx);
  tab.view.webContents.focus();
  broadcastTabs(ctx);
}

function closeTab(ctx, id) {
  const tab = ctx.tabs.get(id);
  if (!tab) return;
  const wasActive = id === ctx.activeTabId;
  if (wasActive) {
    ctx.window.contentView.removeChildView(tab.view);
  }
  if (!tab.isIncognito && !tab.url.startsWith("attach://")) {
    ctx.closedTabsStack.push(tab.url);
    if (ctx.closedTabsStack.length > 20) ctx.closedTabsStack.shift();
  }
  ctx.tabs.delete(id);
  tab.view.webContents.close();

  if (wasActive) {
    const remaining = Array.from(ctx.tabs.keys());
    if (remaining.length > 0) {
      activateTab(ctx, remaining[remaining.length - 1]);
    } else if (ctx.isIncognito) {
      // Closing the last tab of an incognito window closes the window itself,
      // matching how real browsers treat incognito windows.
      ctx.window.close();
      return;
    } else {
      ctx.activeTabId = null;
      createTab(ctx, store.get("settings").homepage);
      return;
    }
  }
  broadcastTabs(ctx);
}

function withActiveTab(ctx, fn) {
  if (!ctx.activeTabId) return;
  const tab = ctx.tabs.get(ctx.activeTabId);
  if (!tab) return;
  fn(tab);
}

function activateTabByOffset(ctx, offset) {
  const ids = Array.from(ctx.tabs.keys());
  if (ids.length === 0) return;
  const currentIndex = ids.indexOf(ctx.activeTabId);
  const nextIndex = (currentIndex + offset + ids.length) % ids.length;
  activateTab(ctx, ids[nextIndex]);
}

function activateTabByIndex(ctx, index) {
  const ids = Array.from(ctx.tabs.keys());
  if (index === "last") {
    if (ids.length > 0) activateTab(ctx, ids[ids.length - 1]);
    return;
  }
  if (ids[index] !== undefined) activateTab(ctx, ids[index]);
}

function reopenLastClosedTab(ctx) {
  const url = ctx.closedTabsStack.pop();
  if (url) createTab(ctx, url);
}

// Registered on the chrome UI's webContents AND every tab's webContents, so
// shortcuts work regardless of where keyboard focus currently is.
function registerShortcuts(webContents, ctx) {
  webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const key = input.key.toLowerCase();

    if (input.alt && key === "arrowleft") {
      withActiveTab(ctx, (tab) => tab.view.webContents.navigationHistory.canGoBack() && tab.view.webContents.navigationHistory.goBack());
      event.preventDefault();
    } else if (input.alt && key === "arrowright") {
      withActiveTab(ctx, (tab) => tab.view.webContents.navigationHistory.canGoForward() && tab.view.webContents.navigationHistory.goForward());
      event.preventDefault();
    } else if (input.control && key === "l") {
      sendToChrome(ctx, "shortcut:focus-address-bar");
      event.preventDefault();
    } else if ((input.control && key === "r") || key === "f5") {
      withActiveTab(ctx, (tab) => tab.view.webContents.reload());
      event.preventDefault();
    } else if (input.control && key === "t") {
      createTab(ctx, store.get("settings").homepage);
      event.preventDefault();
    } else if (input.control && input.shift && key === "t") {
      reopenLastClosedTab(ctx);
      event.preventDefault();
    } else if (input.control && key === "w") {
      if (ctx.activeTabId) closeTab(ctx, ctx.activeTabId);
      event.preventDefault();
    } else if (input.control && input.shift && key === "n") {
      createBrowserWindowContext({ incognito: true });
      event.preventDefault();
    } else if (input.control && key === "tab" && !input.shift) {
      activateTabByOffset(ctx, 1);
      event.preventDefault();
    } else if (input.control && key === "tab" && input.shift) {
      activateTabByOffset(ctx, -1);
      event.preventDefault();
    } else if (input.control && key === "pagedown") {
      activateTabByOffset(ctx, 1);
      event.preventDefault();
    } else if (input.control && key === "pageup") {
      activateTabByOffset(ctx, -1);
      event.preventDefault();
    } else if (input.control && /^[1-8]$/.test(key)) {
      activateTabByIndex(ctx, Number(key) - 1);
      event.preventDefault();
    } else if (input.control && key === "9") {
      activateTabByIndex(ctx, "last");
      event.preventDefault();
    } else if (input.control && key === "d") {
      sendToChrome(ctx, "shortcut:toggle-bookmark");
      event.preventDefault();
    } else if (input.control && key === "h") {
      createTab(ctx, "attach://app/history.html");
      event.preventDefault();
    } else if (input.control && key === "j") {
      createTab(ctx, "attach://app/downloads.html");
      event.preventDefault();
    } else if (input.control && key === "f") {
      withActiveTab(ctx, () => sendToChrome(ctx, "shortcut:find-in-page", { tabId: ctx.activeTabId }));
      event.preventDefault();
    }
  });
}

function createBrowserWindowContext({ incognito = false } = {}) {
  const ctx = createContext(incognito);
  windowContexts.add(ctx);

  const appIcon = loadAppIconImage();
  ctx.window = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#0b0b0d",
    icon: appIcon || resolveAppIcon(),
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });
  if (appIcon) ctx.window.setIcon(appIcon);

  ctx.window.loadFile(path.join(__dirname, "src/chrome/index.html"), incognito ? { query: { incognito: "1" } } : undefined);
  registerShortcuts(ctx.window.webContents, ctx);

  ctx.overlayView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });
  ctx.overlayView.setBackgroundColor("#00000000");
  ctx.overlayView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  ctx.window.contentView.addChildView(ctx.overlayView);
  ctx.overlayView.webContents.loadFile(path.join(__dirname, "src/chrome/panels.html"));
  // A panel closes itself when it loses OS input focus — e.g. the user
  // clicks the toolbar or the page behind it — mirroring a real dropdown's
  // click-outside-to-dismiss without needing an invisible backdrop that
  // would otherwise have to cover (and block clicks on) the live page.
  ctx.overlayView.webContents.on("blur", () => {
    if (ctx.overlayPanelSize) closeOverlayPanel(ctx);
  });

  ctx.window.webContents.on("did-finish-load", () => {
    if (ctx.tabs.size === 0) createTab(ctx, store.get("settings").homepage);
    prewarmSpareTab(ctx);
  });

  ctx.window.on("maximize", () => sendToChrome(ctx, "window:maximized-changed", true));
  ctx.window.on("unmaximize", () => sendToChrome(ctx, "window:maximized-changed", false));
  ctx.window.on("resize", () => {
    layoutActiveView(ctx);
    if (ctx.overlayPanelSize) positionOverlayPanel(ctx, ctx.overlayPanelSize.width, ctx.overlayPanelSize.height);
  });
  ctx.window.on("closed", () => {
    windowContexts.delete(ctx);
    if (ctx.spareTab) ctx.spareTab.webContents.close();
    if (ctx.overlayView) ctx.overlayView.webContents.close();
    if (incognito && !Array.from(windowContexts).some((c) => c.isIncognito)) {
      session.fromPartition(INCOGNITO_PARTITION, { cache: false }).clearStorageData();
    }
  });

  return ctx;
}

function registerInternalProtocol() {
  const handler = (request) => {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" || !url.pathname ? "/newtab.html" : url.pathname;
    const filePath = path.join(__dirname, "src", "pages", pathname);
    return net.fetch("file://" + filePath.replace(/\\/g, "/"));
  };
  // Each session has its own protocol registry — must register on every
  // session we actually use, not just the default one.
  protocol.handle("attach", handler);
  session.fromPartition(INCOGNITO_PARTITION, { cache: false }).protocol.handle("attach", handler);
}

function setupDownloadsOn(sess) {
  sess.on("will-download", (_event, item) => {
    const id = crypto.randomUUID();
    downloads.set(id, {
      id,
      filename: item.getFilename(),
      url: item.getURL(),
      savePath: item.getSavePath(),
      state: "progressing",
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
    });
    broadcastToAll("downloads:updated", Array.from(downloads.values()));

    item.on("updated", (_e, state) => {
      const entry = downloads.get(id);
      if (!entry) return;
      entry.state = state;
      entry.receivedBytes = item.getReceivedBytes();
      entry.savePath = item.getSavePath();
      broadcastToAll("downloads:updated", Array.from(downloads.values()));
    });

    item.once("done", (_e, state) => {
      const entry = downloads.get(id);
      if (!entry) return;
      entry.state = state;
      entry.savePath = item.getSavePath();
      broadcastToAll("downloads:updated", Array.from(downloads.values()));
    });
  });
}

function setupDownloads() {
  setupDownloadsOn(session.defaultSession);
  setupDownloadsOn(session.fromPartition(INCOGNITO_PARTITION, { cache: false }));
}

// ---- IPC handlers ----
ipcMain.handle("tab:create", (event, url) => {
  const ctx = contextForSenderId(event.sender.id);
  return ctx ? createTab(ctx, url) : null;
});
ipcMain.handle("tab:close", (event, id) => {
  const found = findTab(id);
  if (found) closeTab(found.ctx, id);
});
ipcMain.handle("tab:activate", (event, id) => {
  const found = findTab(id);
  if (found) activateTab(found.ctx, id);
});
ipcMain.handle("tab:list", (event) => {
  const ctx = contextForSenderId(event.sender.id);
  return ctx ? serializeTabs(ctx) : [];
});

ipcMain.handle("app:new-incognito-window", () => {
  createBrowserWindowContext({ incognito: true });
});

ipcMain.handle("nav:go", (_e, { tabId, input }) => {
  const found = findTab(tabId);
  if (!found) return;
  const target = resolveInput(input);
  if (!target) return;
  found.tab.view.webContents.loadURL(target);
});
ipcMain.handle("nav:back", (_e, tabId) => findTab(tabId)?.tab.view.webContents.navigationHistory.goBack());
ipcMain.handle("nav:forward", (_e, tabId) => findTab(tabId)?.tab.view.webContents.navigationHistory.goForward());
ipcMain.handle("nav:reload", (_e, tabId) => findTab(tabId)?.tab.view.webContents.reload());
ipcMain.handle("nav:stop", (_e, tabId) => findTab(tabId)?.tab.view.webContents.stop());
ipcMain.handle("nav:home", (_e, tabId) => findTab(tabId)?.tab.view.webContents.loadURL(store.get("settings").homepage));
ipcMain.handle("nav:go-self", (event, input) => {
  const found = findTabBySenderId(event.sender.id);
  if (!found) return;
  const target = resolveInput(input);
  if (target) found.tab.view.webContents.loadURL(target);
});

ipcMain.handle("bookmarks:list", () => store.get("bookmarks"));
ipcMain.handle("bookmarks:add", (_e, { title, url }) => {
  const bookmarks = store.get("bookmarks");
  if (bookmarks.some((b) => b.url === url)) return bookmarks;
  bookmarks.unshift({ id: crypto.randomUUID(), title: title || url, url, createdAt: Date.now() });
  store.set("bookmarks", bookmarks);
  return bookmarks;
});
ipcMain.handle("bookmarks:remove", (_e, id) => {
  store.set("bookmarks", store.get("bookmarks").filter((b) => b.id !== id));
  return store.get("bookmarks");
});

ipcMain.handle("history:list", (_e, query) => {
  const history = store.get("history");
  if (!query) return history;
  return history.filter((h) => h.url.includes(query) || h.title.toLowerCase().includes(query.toLowerCase()));
});
ipcMain.handle("history:removeEntry", (_e, id) => {
  store.set("history", store.get("history").filter((h) => h.id !== id));
  return store.get("history");
});
ipcMain.handle("history:clear", (_e, range) => {
  if (!range || range === "all") {
    store.set("history", []);
  } else {
    const cutoff = Date.now() - range;
    store.set("history", store.get("history").filter((h) => h.visitedAt < cutoff));
  }
  return store.get("history");
});

ipcMain.handle("downloads:list", () => Array.from(downloads.values()));
ipcMain.handle("downloads:openFile", (_e, id) => shell.openPath(downloads.get(id)?.savePath || ""));
ipcMain.handle("downloads:openFolder", (_e, id) => {
  const entry = downloads.get(id);
  if (entry) shell.showItemInFolder(entry.savePath);
});

ipcMain.handle("settings:get", () => store.get("settings"));
ipcMain.handle("settings:set", (_e, partial) => {
  store.set("settings", { ...store.get("settings"), ...partial });
  return store.get("settings");
});

ipcMain.handle("window:minimize", (event) => contextForSenderId(event.sender.id)?.window.minimize());
ipcMain.handle("window:maximize-toggle", (event) => {
  const ctx = contextForSenderId(event.sender.id);
  if (!ctx) return;
  ctx.window.isMaximized() ? ctx.window.unmaximize() : ctx.window.maximize();
});
ipcMain.handle("window:close", (event) => contextForSenderId(event.sender.id)?.window.close());
ipcMain.handle("window:is-maximized", (event) => contextForSenderId(event.sender.id)?.window.isMaximized() ?? false);

// Called from the chrome shell (toolbar icon clicks) to show a panel in
// the dedicated overlay view. The overlay is brought to the top of the
// z-order (it can end up below a more-recently-activated tab view
// otherwise) and given focus so a later click elsewhere reliably blurs it.
ipcMain.handle("ui:open-panel", (event, name) => {
  const ctx = contextForSenderId(event.sender.id);
  if (!ctx || !ctx.overlayView) return;
  // Re-adding an already-added child view reorders it to the top of the
  // z-stack — needed since a tab activated after the overlay was created
  // would otherwise render above it.
  ctx.window.contentView.addChildView(ctx.overlayView);
  ctx.overlayView.webContents.send("panel:show", name);
  ctx.overlayView.webContents.focus();
});

// Called from the panels view itself (Escape key, its own close button, or
// losing focus) once it's done showing anything.
ipcMain.handle("ui:close-panel", (event) => {
  const ctx = contextForSenderId(event.sender.id);
  if (!ctx) return;
  closeOverlayPanel(ctx);
});

// The panels view reports its actual rendered content size (via
// ResizeObserver) after showing a panel, so the overlay is sized to
// exactly match it — any extra bounds beyond the visible panel would be a
// transparent "dead zone" that still swallows clicks meant for the page.
ipcMain.handle("ui:report-panel-size", (event, { width, height }) => {
  const ctx = contextForSenderId(event.sender.id);
  if (!ctx || !ctx.overlayView) return;
  if (!width || !height) {
    closeOverlayPanel(ctx);
    return;
  }
  ctx.overlayPanelSize = { width, height };
  positionOverlayPanel(ctx, width, height);
});

ipcMain.handle("auth:get-profile", () => store.get("account", null));
ipcMain.handle("auth:sign-in", () => signInWithGoogle());
ipcMain.handle("auth:sign-out", () => {
  store.delete("account");
  store.delete("accountRefreshToken");
  return null;
});

// ---- Multi-profile (native Vinaru accounts), backed by accounts-backend ----
function saveProfile(profileData) {
  const profiles = store.get("profiles", []);
  const id = `${profileData.type}-${profileData.email}`;
  const profile = {
    id,
    type: profileData.type,
    email: profileData.email,
    displayName: profileData.displayName,
    avatarColor: profileData.avatarColor || null,
    picture: profileData.picture || null,
    accessToken: profileData.accessToken,
    refreshToken: profileData.refreshToken,
    createdAt: profileData.createdAt || Date.now(),
    signedOut: false,
  };
  const existingIndex = profiles.findIndex((p) => p.id === id);
  if (existingIndex >= 0) profiles[existingIndex] = profile;
  else profiles.push(profile);
  store.set("profiles", profiles);
  store.set("activeProfileId", id);
  broadcastToAll("profiles:active-changed", profile);
  return profile;
}

function getActiveProfile() {
  const activeId = store.get("activeProfileId", null);
  return store.get("profiles", []).find((p) => p.id === activeId) || null;
}

async function registerProfile(email, password, displayName, dob, mobile) {
  const res = await fetch(`${ACCOUNTS_BACKEND_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName, dob, mobile }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  return saveProfile({ type: "local", ...data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
}

async function checkEmailAvailable(email) {
  const res = await fetch(`${ACCOUNTS_BACKEND_URL}/auth/check-email?email=${encodeURIComponent(email)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not check email availability");
  return data.available;
}

async function sendMobileOtp(mobile) {
  const res = await fetch(`${ACCOUNTS_BACKEND_URL}/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not send verification code");
  return data;
}

async function verifyMobileOtp(mobile, code) {
  const res = await fetch(`${ACCOUNTS_BACKEND_URL}/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile, code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Verification failed");
  return data;
}

async function loginProfile(email, password) {
  const res = await fetch(`${ACCOUNTS_BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return saveProfile({ type: "local", ...data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
}

ipcMain.handle("profiles:list", () => store.get("profiles", []));
ipcMain.handle("profiles:get-active", () => getActiveProfile());
ipcMain.handle("profiles:check-email", (_e, email) => checkEmailAvailable(email));
ipcMain.handle("profiles:send-otp", (_e, mobile) => sendMobileOtp(mobile));
ipcMain.handle("profiles:verify-otp", (_e, { mobile, code }) => verifyMobileOtp(mobile, code));
ipcMain.handle("profiles:register", (_e, { email, password, displayName, dob, mobile }) =>
  registerProfile(email, password, displayName, dob, mobile)
);
ipcMain.handle("profiles:login", (_e, { email, password }) => loginProfile(email, password));
ipcMain.handle("profiles:remove", (_e, id) => {
  store.set("profiles", store.get("profiles", []).filter((p) => p.id !== id));
  if (store.get("activeProfileId") === id) {
    store.set("activeProfileId", null);
    broadcastToAll("profiles:active-changed", null);
  }
  return store.get("profiles", []);
});
ipcMain.handle("profiles:clear-active", () => {
  const activeId = store.get("activeProfileId", null);
  if (activeId) {
    const profiles = store.get("profiles", []);
    const idx = profiles.findIndex((p) => p.id === activeId);
    if (idx >= 0) {
      profiles[idx] = { ...profiles[idx], signedOut: true };
      store.set("profiles", profiles);
    }
  }
  store.set("activeProfileId", null);
  broadcastToAll("profiles:active-changed", null);
  return null;
});
ipcMain.handle("profiles:set-active", (_e, id) => {
  store.set("activeProfileId", id);
  const active = getActiveProfile();
  broadcastToAll("profiles:active-changed", active);
  return active;
});

ipcMain.handle("vpn:list-servers", () => vpnManager.listServers());
ipcMain.handle("vpn:connect", (_e, serverId) => vpnManager.connect(serverId));
ipcMain.handle("vpn:disconnect", () => vpnManager.disconnect());
ipcMain.handle("vpn:get-status", () => vpnManager.getStatus());
ipcMain.handle("vpn:set-kill-switch", (_e, enabled) => vpnManager.setKillSwitch(enabled));

ipcMain.handle("vpn:get-privacy-settings", () => store.get("vpnPrivacySettings"));
ipcMain.handle("vpn:set-privacy-settings", (_e, partial) => {
  const updated = { ...store.get("vpnPrivacySettings"), ...partial };
  store.set("vpnPrivacySettings", updated);
  applyPrivacySettings(session.defaultSession, updated);
  for (const ctx of windowContexts) {
    for (const tab of ctx.tabs.values()) applyWebRTCPolicy(tab.view.webContents, updated);
  }
  return updated;
});

app.whenReady().then(() => {
  registerInternalProtocol();
  setupDownloads();
  applyPrivacySettings(session.defaultSession, store.get("vpnPrivacySettings"));
  createBrowserWindowContext({ incognito: false });
});

app.on("window-all-closed", () => {
  app.quit();
});
