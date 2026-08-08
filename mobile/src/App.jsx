import { useCallback, useEffect, useMemo, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { openUrl, resolveInput } from "./browse.js";

const SHORTCUTS = [
  { title: "Google", url: "https://www.google.com" },
  { title: "YouTube", url: "https://www.youtube.com" },
  { title: "Wikipedia", url: "https://www.wikipedia.org" },
  { title: "GitHub", url: "https://github.com" },
  { title: "Vinaru", url: "https://vinaru.onrender.com" },
  { title: "Ruachvi", url: "https://ruachvi.com" },
];

const IconBack = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconForward = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconSearch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const IconPlus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconMore = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="5" r="1.7" fill="currentColor" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    <circle cx="12" cy="19" r="1.7" fill="currentColor" />
  </svg>
);
const IconVpn = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);
const IconIncognito = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M3 13c1.5-4 4.5-6 9-6s7.5 2 9 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="7" cy="14.5" r="2.6" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="17" cy="14.5" r="2.6" stroke="currentColor" strokeWidth="1.6" />
    <path d="M9.6 14.5h4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

function newTab({ url = "", incognito = false } = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: url ? "Loading…" : incognito ? "Private Tab" : "New Tab",
    url,
    incognito,
    history: url ? [url] : [],
    histIndex: url ? 0 : -1,
  };
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Vinaru";
  }
}

function displayUrl(url) {
  if (!url) return "";
  return url.replace(/^https:\/\//i, "");
}

export default function App() {
  const [tabs, setTabs] = useState(() => [newTab()]);
  const [activeId, setActiveId] = useState(() => tabs[0].id);
  const [draft, setDraft] = useState("");
  const [panel, setPanel] = useState(null); // 'profile' | 'vpn' | 'more' | 'tabs' | null
  const [toast, setToast] = useState("");
  const [vpnConnected, setVpnConnected] = useState(false);
  const [vpnConnecting, setVpnConnecting] = useState(false);

  const active = useMemo(() => tabs.find((t) => t.id === activeId) || tabs[0], [tabs, activeId]);
  const canGoBack = (active?.histIndex ?? -1) > 0 || Boolean(active?.url);
  const canGoForward = (active?.histIndex ?? -1) >= 0 && (active?.histIndex ?? -1) < (active?.history?.length ?? 0) - 1;

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1800);
  }, []);

  const closePanels = useCallback(() => setPanel(null), []);

  const updateActive = useCallback(
    (patch) => {
      setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, ...patch } : t)));
    },
    [activeId]
  );

  const navigate = useCallback(
    async (raw) => {
      const url = resolveInput(raw);
      if (!url) return;
      const incognito = Boolean(active?.incognito);
      setDraft(displayUrl(url));

      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeId) return t;
          const base = (t.history || []).slice(0, (t.histIndex ?? -1) + 1);
          const history = [...base, url];
          return {
            ...t,
            url,
            title: hostnameOf(url),
            history,
            histIndex: history.length - 1,
          };
        })
      );

      closePanels();
      await openUrl(url, { incognito });
    },
    [active?.incognito, activeId, closePanels]
  );

  useEffect(() => {
    setDraft(displayUrl(active?.url || ""));
  }, [active?.id, active?.url]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    const sub = CapApp.addListener("backButton", ({ canGoBack: histBack }) => {
      if (panel) {
        setPanel(null);
        return;
      }
      if (histBack) window.history.back();
      else CapApp.exitApp();
    });
    return () => {
      sub.then((h) => h.remove()).catch(() => {});
    };
  }, [panel]);

  function addTab(incognito = false) {
    const tab = newTab({ incognito });
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    setDraft("");
    closePanels();
    if (incognito) showToast("Private tab — browsing won’t save history");
  }

  function closeTab(id) {
    setTabs((prev) => {
      if (prev.length === 1) {
        const fresh = newTab();
        setActiveId(fresh.id);
        return [fresh];
      }
      const next = prev.filter((t) => t.id !== id);
      if (id === activeId) setActiveId(next[next.length - 1].id);
      return next;
    });
  }

  function goHome() {
    // Reset page history so Back/Forward don't point at stale entries after Home.
    updateActive({
      url: "",
      title: active?.incognito ? "Private Tab" : "New Tab",
      history: [],
      histIndex: -1,
    });
    setDraft("");
    closePanels();
  }

  function focusAddress() {
    const input = document.getElementById("addressInput");
    if (input) {
      input.focus();
      input.select();
    }
    closePanels();
  }

  function goBack() {
    if (!active) return;
    if ((active.histIndex ?? -1) > 0) {
      const nextIndex = active.histIndex - 1;
      const url = active.history[nextIndex];
      setTabs((prev) =>
        prev.map((t) => (t.id === activeId ? { ...t, histIndex: nextIndex, url, title: hostnameOf(url) } : t))
      );
      setDraft(displayUrl(url));
      closePanels();
      openUrl(url, { incognito: Boolean(active.incognito) });
      return;
    }
    if (active.url) goHome();
  }

  function goForward() {
    if (!active || !canGoForward) return;
    const nextIndex = active.histIndex + 1;
    const url = active.history[nextIndex];
    setTabs((prev) =>
      prev.map((t) => (t.id === activeId ? { ...t, histIndex: nextIndex, url, title: hostnameOf(url) } : t))
    );
    setDraft(displayUrl(url));
    closePanels();
    openUrl(url, { incognito: Boolean(active.incognito) });
  }

  function toggleVpn() {
    if (vpnConnecting) return;
    if (vpnConnected) {
      setVpnConnected(false);
      showToast("VPN disconnected");
      return;
    }
    setVpnConnecting(true);
    window.setTimeout(() => {
      setVpnConnecting(false);
      setVpnConnected(true);
      showToast("VPN connected (simulated)");
    }, 900);
  }

  function togglePanel(name) {
    setPanel((cur) => (cur === name ? null : name));
  }

  return (
    <div className={`shell ${active?.incognito ? "incognito" : ""}`}>
      {panel ? <button type="button" className="popup-backdrop" aria-label="Close panel" onClick={closePanels} /> : null}

      <div className="top-row">
        <form
          className="top-omnibox"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(draft);
          }}
        >
          <input
            id="addressInput"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={active?.incognito ? "Private search or URL" : "Search Vinaru or type URL"}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            enterKeyHint="go"
          />
        </form>

        <div className="top-actions">
          <button
            type="button"
            className={`top-icon-btn vpn-btn ${vpnConnected ? "on" : ""} ${vpnConnecting ? "busy" : ""}`}
            onClick={() => togglePanel("vpn")}
            title="VPN"
            aria-label="VPN"
          >
            <IconVpn />
            <span className={`vpn-dot ${vpnConnected ? "connected" : ""} ${vpnConnecting ? "connecting" : ""}`} />
          </button>
          <button
            type="button"
            className="profile-icon-btn"
            onClick={() => togglePanel("profile")}
            title="Profile"
            aria-label="Profile"
          >
            <span className="avatar">V</span>
          </button>
        </div>
      </div>

      {panel === "profile" ? (
        <div className="popup panel-top-right" role="dialog" aria-label="Profile">
          <div className="popup-header">
            <span>Guest profile</span>
            <button type="button" className="popup-close" onClick={closePanels}>
              ×
            </button>
          </div>
          <div className="popup-body profile-body">
            <span className="avatar large">V</span>
            <div className="profile-greeting">Hi, Guest!</div>
            <button type="button" className="popup-primary" onClick={() => showToast("Profile manager coming soon")}>
              Manage profile
            </button>
          </div>
          <div className="popup-list">
            <button type="button" onClick={() => { addTab(true); }}>
              <IconIncognito />
              <span>New private tab</span>
            </button>
          </div>
        </div>
      ) : null}

      {panel === "vpn" ? (
        <div className="popup panel-top-right" role="dialog" aria-label="VPN">
          <div className="popup-header">
            <span>VPN</span>
            <button type="button" className="popup-close" onClick={closePanels}>
              ×
            </button>
          </div>
          <div className="popup-body vpn-body">
            <div className="vpn-status">{vpnConnecting ? "Connecting…" : vpnConnected ? "Connected" : "Not connected"}</div>
            {vpnConnected ? <div className="vpn-badge">Simulated</div> : null}
            <button
              type="button"
              className={`popup-primary ${vpnConnected ? "danger" : ""}`}
              disabled={vpnConnecting}
              onClick={toggleVpn}
            >
              {vpnConnecting ? "Connecting…" : vpnConnected ? "Disconnect" : "Connect"}
            </button>
          </div>
          <div className="popup-list muted">
            <div className="vpn-row"><span>Server</span><span>Auto</span></div>
            <div className="vpn-row"><span>Protocol</span><span>WireGuard</span></div>
            <div className="vpn-row"><span>Kill switch</span><span>Off</span></div>
          </div>
        </div>
      ) : null}

      {panel === "more" ? (
        <div className="popup panel-bottom-right" role="dialog" aria-label="Menu">
          <div className="popup-header">
            <span>Menu</span>
            <button type="button" className="popup-close" onClick={closePanels}>
              ×
            </button>
          </div>
          <div className="popup-pair">
            <button type="button" onClick={() => { showToast("Bookmarks coming soon"); closePanels(); }}>Bookmarks</button>
            <button type="button" onClick={() => { showToast("History coming soon"); closePanels(); }}>History</button>
          </div>
          <div className="popup-list">
            <button type="button" onClick={() => { addTab(false); }}>New tab</button>
            <button type="button" onClick={() => { addTab(true); }}>New private tab</button>
            <button type="button" onClick={() => { goHome(); }}>Home / New Tab page</button>
            <button type="button" onClick={() => { setPanel("tabs"); }}>Tabs ({tabs.length})</button>
            <button type="button" onClick={() => { showToast("Downloads coming soon"); closePanels(); }}>Downloads</button>
            <button type="button" onClick={() => { showToast("Settings coming soon"); closePanels(); }}>Settings</button>
          </div>
        </div>
      ) : null}

      {panel === "tabs" ? (
        <div className="tabs-sheet">
          <div className="tabs-sheet-header">
            <span>Tabs ({tabs.length})</span>
            <button type="button" className="sheet-action" onClick={() => addTab(false)}>
              + New
            </button>
          </div>
          <div className="tabs-sheet-list">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`tabs-sheet-item ${tab.id === activeId ? "active" : ""} ${tab.incognito ? "incognito" : ""}`}
                onClick={() => {
                  setActiveId(tab.id);
                  closePanels();
                }}
              >
                <span className="tabs-sheet-title">{tab.title}</span>
                <span className="tabs-sheet-url">{tab.url ? hostnameOf(tab.url) : tab.incognito ? "Private Tab" : "New Tab"}</span>
                <span
                  className="tabs-sheet-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  aria-label="Close tab"
                >
                  <IconClose />
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <main className="newtab">
        {active?.incognito ? <div className="private-badge">Private</div> : null}
        <div className="logo">V</div>
        <h1>{active?.incognito ? "Private browsing" : "Vinaru"}</h1>
        {active?.incognito ? (
          <p className="private-note">Pages you visit in this tab won’t be saved to history on this device.</p>
        ) : null}

        <form
          className="search-card"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(draft);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search or enter address"
            spellCheck={false}
          />
        </form>

        {!active?.incognito ? (
          <div className="shortcuts">
            {SHORTCUTS.map((site) => (
              <button key={site.url} type="button" className="shortcut" onClick={() => navigate(site.url)}>
                <span className="shortcut-icon">{site.title[0]}</span>
                <span className="shortcut-label">{hostnameOf(site.url)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </main>

      <nav className="bottom-bar" aria-label="Browser tools">
        <button type="button" className="bottom-btn" disabled={!canGoBack} onClick={goBack} title="Previous page" aria-label="Previous page">
          <IconBack />
        </button>
        <button type="button" className="bottom-btn" disabled={!canGoForward} onClick={goForward} title="Next page" aria-label="Next page">
          <IconForward />
        </button>
        <button type="button" className="bottom-btn" onClick={focusAddress} title="Search" aria-label="Search">
          <IconSearch />
        </button>
        <button type="button" className="bottom-btn" onClick={() => addTab(false)} title="New page" aria-label="New page">
          <IconPlus />
        </button>
        <button
          type="button"
          className={`bottom-btn ${panel === "more" ? "active" : ""}`}
          onClick={() => togglePanel("more")}
          title="More"
          aria-label="More"
        >
          <IconMore />
        </button>
      </nav>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
