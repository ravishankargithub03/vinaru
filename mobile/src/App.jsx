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

const IconHome = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M3 11l9-8 9 8M5 10v10h14V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconBookmark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M6 4h12v17l-6-3.5L6 21V4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);
const IconSearch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const IconMore = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="5" r="1.7" fill="currentColor" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    <circle cx="12" cy="19" r="1.7" fill="currentColor" />
  </svg>
);
const IconShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
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
  const [tabsOpen, setTabsOpen] = useState(false);
  const [toast, setToast] = useState("");

  const active = useMemo(() => tabs.find((t) => t.id === activeId) || tabs[0], [tabs, activeId]);

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
      setTabsOpen(false);
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
      if (tabsOpen) {
        setTabsOpen(false);
        return;
      }
      if (histBack) window.history.back();
      else CapApp.exitApp();
    });
    return () => {
      sub.then((h) => h.remove()).catch(() => {});
    };
  }, [menuOpen, tabsOpen]);

  function addTab(incognito = false) {
    const tab = newTab({ incognito });
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    setDraft("");
    setMenuOpen(false);
    setTabsOpen(false);
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
    setTabsOpen(false);
  }

  function focusAddress() {
    const input = document.getElementById("addressInput");
    if (input) {
      input.focus();
      input.select();
    }
    setMenuOpen(false);
    setTabsOpen(false);
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
      {/* Brave-style top address bar — profile icon on the left */}
      <form
        className="top-omnibox"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(draft);
        }}
      >
        <button
          type="button"
          className="profile-in-bar"
          onClick={() => showToast("Profiles coming soon")}
          title="Profile"
          aria-label="Profile"
        >
          <span className="avatar">V</span>
        </button>

        <input
          id="addressInput"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search Vinaru or type URL"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          enterKeyHint="go"
        />

        <button
          type="button"
          className="omnibox-icon"
          onClick={() => showToast("Shield / privacy coming soon")}
          title="Shield"
          aria-label="Shield"
        >
          <IconShield />
        </button>
        <button
          type="button"
          className={`omnibox-icon ${active?.url && starred.has(active.url) ? "starred" : ""}`}
          onClick={toggleStar}
          title="Bookmark"
          aria-label="Bookmark"
        >
          <IconBookmark />
        </button>
      </form>

      {menuOpen ? (
        <div className="more-menu">
          <button type="button" onClick={() => addTab(false)}>
            New tab
          </button>
          <button type="button" onClick={() => addTab(true)}>
            New private tab
          </button>
          <button type="button" onClick={goHome}>
            Home / New Tab page
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              showToast("Settings coming soon");
            }}
          >
            Settings
          </button>
        </div>
      ) : null}

      {tabsOpen ? (
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
                  setTabsOpen(false);
                }}
              >
                <span className="tabs-sheet-title">{tab.title}</span>
                <span className="tabs-sheet-url">{tab.url ? hostnameOf(tab.url) : "New Tab"}</span>
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

      {/* Brave-style bottom toolbar */}
      <nav className="bottom-bar" aria-label="Browser tools">
        <button type="button" className="bottom-btn" onClick={goHome} title="Home" aria-label="Home">
          <IconHome />
        </button>
        <button type="button" className="bottom-btn" onClick={toggleStar} title="Bookmarks" aria-label="Bookmarks">
          <IconBookmark />
        </button>
        <button type="button" className="bottom-btn" onClick={focusAddress} title="Search" aria-label="Search">
          <IconSearch />
        </button>
        <button
          type="button"
          className={`bottom-btn tabs-count-btn ${tabsOpen ? "active" : ""}`}
          onClick={() => {
            setTabsOpen((v) => !v);
            setMenuOpen(false);
          }}
          title="Tabs"
          aria-label={`Tabs, ${tabs.length} open`}
        >
          <span className="tabs-count">{tabs.length}</span>
        </button>
        <button
          type="button"
          className={`bottom-btn ${menuOpen ? "active" : ""}`}
          onClick={() => {
            setMenuOpen((v) => !v);
            setTabsOpen(false);
          }}
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
