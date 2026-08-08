import { useCallback, useEffect, useMemo, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { closeBrowser, openUrl, resolveInput } from "./browse.js";

const SHORTCUTS = [
  { title: "Google", url: "https://www.google.com" },
  { title: "YouTube", url: "https://www.youtube.com" },
  { title: "Wikipedia", url: "https://www.wikipedia.org" },
  { title: "GitHub", url: "https://github.com" },
  { title: "Vinaru", url: "https://vinaru.onrender.com" },
];

function newTab(url = "") {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: url ? "Loading…" : "New Tab",
    url,
  };
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Vinaru";
  }
}

export default function App() {
  const [tabs, setTabs] = useState(() => [newTab()]);
  const [activeId, setActiveId] = useState(() => tabs[0].id);
  const [draft, setDraft] = useState("");

  const active = useMemo(() => tabs.find((t) => t.id === activeId) || tabs[0], [tabs, activeId]);

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
      setDraft(url.replace(/^https:\/\//i, ""));
      updateActive({ url, title: hostnameOf(url) });
      await openUrl(url);
    },
    [updateActive]
  );

  useEffect(() => {
    setDraft(active?.url ? active.url.replace(/^https:\/\//i, "") : "");
  }, [active?.id, active?.url]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    const sub = CapApp.addListener("backButton", async ({ canGoBack }) => {
      try {
        await closeBrowser();
      } catch {
        /* ignore */
      }
      if (canGoBack) window.history.back();
      else CapApp.exitApp();
    });

    return () => {
      sub.then((h) => h.remove()).catch(() => {});
    };
  }, []);

  function addTab() {
    const tab = newTab();
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    setDraft("");
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

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand" aria-hidden="true">
          V
        </div>
        <form
          className="omnibox"
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
            autoCapitalize="off"
            autoCorrect="off"
            enterKeyHint="go"
          />
          <button type="submit" className="go-btn" aria-label="Go">
            Go
          </button>
        </form>
      </header>

      <div className="tabstrip">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab ${tab.id === activeId ? "active" : ""}`}
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
        <button type="button" className="tab-add" onClick={addTab} aria-label="New tab">
          +
        </button>
      </div>

      <main className="newtab">
        <div className="logo">V</div>
        <h1>Vinaru</h1>
        <p className="tagline">The web, without leaving your work.</p>

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
            placeholder="Search Google or type a URL"
            spellCheck={false}
          />
        </form>

        <div className="shortcuts">
          {SHORTCUTS.map((site) => (
            <button key={site.url} type="button" className="shortcut" onClick={() => navigate(site.url)}>
              <span className="shortcut-icon">{site.title[0]}</span>
              <span>{site.title}</span>
            </button>
          ))}
        </div>

        {active?.url ? (
          <button type="button" className="reopen" onClick={() => navigate(active.url)}>
            Reopen {active.title}
          </button>
        ) : null}
      </main>
    </div>
  );
}
