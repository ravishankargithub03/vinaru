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
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconForward = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconReload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M3 12a9 9 0 1 1 3 6.7M3 12V6m0 6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconHome = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
    <path d="M3 11l9-8 9 8M5 10v10h14V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconStar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.8 5.5 21l2-7.5L2 9h7z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);
const IconIncognito = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
    <path d="M3 13c1.5-4 4.5-6 9-6s7.5 2 9 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="7" cy="14.5" r="2.6" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="17" cy="14.5" r="2.6" stroke="currentColor" strokeWidth="1.6" />
    <path d="M9.6 14.5h4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IconVpn = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);
const IconMore = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="5" r="1.8" fill="currentColor" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="19" r="1.8" fill="currentColor" />
  </svg>
);

function newTab({ url = "", incognito = false } = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: url ? "Loading…" : "New Tab",
    url,
    incognito,
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
  const [starred, setStarred] = useState(() => new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");

  const active = useMemo(() => tabs.find((t) => t.id === activeId) || tabs[0], [tabs, activeId]);
  const canGoBack = Boolean(active?.url);
  const canGoForward = false;

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1800);
  }, []);

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
      setDraft(displayUrl(url));
      updateActive({ url, title: hostnameOf(url) });
      setMenuOpen(false);
      await openUrl(url);
    },
    [updateActive]
  );

  useEffect(() => {
    setDraft(displayUrl(active?.url || ""));
  }, [active?.id, active?.url]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    const sub = CapApp.addListener("backButton", ({ canGoBack: histBack }) => {
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      if (histBack) window.history.back();
      else CapApp.exitApp();
    });
    return () => {
      sub.then((h) => h.remove()).catch(() => {});
    };
  }, [menuOpen]);

  function addTab(incognito = false) {
    const tab = newTab({ incognito });
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    setDraft("");
    setMenuOpen(false);
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
    updateActive({ url: "", title: "New Tab" });
    setDraft("");
    setMenuOpen(false);
  }

  function toggleStar() {
    if (!active?.url) {
      showToast("Open a page to bookmark it");
      return;
    }
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(active.url)) {
        next.delete(active.url);
        showToast("Bookmark removed");
      } else {
        next.add(active.url);
        showToast("Bookmark saved");
      }
      return next;
    });
  }

  return (
    <div className={`shell ${active?.incognito ? "incognito" : ""}`}>
      {/* Desktop-style tab strip — above toolbar / search */}
      <div className="tabstrip">
        <div className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab ${tab.id === activeId ? "active" : ""} ${tab.incognito ? "incognito" : ""}`}
              onClick={() => setActiveId(tab.id)}
            >
              <span className="tab-title">{tab.title}</span>
              <span
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                ×
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="new-tab-btn" onClick={() => addTab(false)} aria-label="New tab" title="New Tab">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Marked desktop toolbar section */}
      <div className="toolbar">
        <button type="button" className="nav-btn" disabled={!canGoBack} onClick={() => active?.url && navigate(active.url)} title="Back">
          <IconBack />
        </button>
        <button type="button" className="nav-btn" disabled={!canGoForward} title="Forward">
          <IconForward />
        </button>
        <button
          type="button"
          className="nav-btn"
          onClick={() => (active?.url ? navigate(active.url) : showToast("Nothing to reload"))}
          title="Reload"
        >
          <IconReload />
        </button>
        <button type="button" className="nav-btn" onClick={goHome} title="Home">
          <IconHome />
        </button>

        <form
          className="address-bar"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(draft);
          }}
        >
          <span className={`security-indicator ${active?.url ? "secure" : ""}`} />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search or enter address"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            enterKeyHint="go"
          />
          <button
            type="button"
            className={`star-btn ${active?.url && starred.has(active.url) ? "active" : ""}`}
            onClick={toggleStar}
            title="Bookmark"
          >
            <IconStar />
          </button>
        </form>

        <button type="button" className="profile-icon-btn" onClick={() => showToast("Profiles coming soon")} title="Profile">
          <span className="avatar">V</span>
        </button>
        <button type="button" className="icon-btn" onClick={() => addTab(true)} title="New incognito tab">
          <IconIncognito />
        </button>
        <button type="button" className="icon-btn" onClick={() => showToast("VPN coming soon on Android")} title="VPN">
          <IconVpn />
        </button>
        <button type="button" className="icon-btn" onClick={() => setMenuOpen((v) => !v)} title="More">
          <IconMore />
        </button>
      </div>

      {menuOpen ? (
        <div className="more-menu">
          <button type="button" onClick={() => { addTab(false); }}>
            New tab
          </button>
          <button type="button" onClick={() => { addTab(true); }}>
            New incognito tab
          </button>
          <button type="button" onClick={() => { goHome(); }}>
            Home / New Tab page
          </button>
          <button type="button" onClick={() => { setMenuOpen(false); showToast("Settings coming soon"); }}>
            Settings
          </button>
        </div>
      ) : null}

      <main className="newtab">
        <div className="logo">V</div>
        <h1>Vinaru</h1>

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

        <div className="shortcuts">
          {SHORTCUTS.map((site) => (
            <button key={site.url} type="button" className="shortcut" onClick={() => navigate(site.url)}>
              <span className="shortcut-icon">{site.title[0]}</span>
              <span className="shortcut-label">{hostnameOf(site.url)}</span>
            </button>
          ))}
        </div>
      </main>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
