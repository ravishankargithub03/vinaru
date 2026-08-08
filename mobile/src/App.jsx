import { useCallback, useEffect, useMemo, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  openUrl,
  resolveInput,
  listDownloads,
  openDownload,
  openDownloadsFolder,
  listBookmarks,
  addBookmark,
  removeBookmark,
  isBookmarked,
  listHistory,
  recordHistory,
  removeHistory,
  clearHistory,
  listProfiles,
  getActiveProfile,
  saveAccountProfile,
  setActiveProfile,
  clearActiveProfile,
  removeProfile,
} from "./browse.js";
import {
  COUNTRIES,
  EMAIL_DOMAIN,
  checkEmailAvailable,
  sendOtp,
  verifyOtp,
  registerAccount,
  loginAccount,
  toVinaruEmail,
  normalizeUsername,
  isPasswordValid,
  passwordHint,
} from "./accounts.js";

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
const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconForward = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
const IconApps = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="5" cy="5" r="1.6" fill="currentColor" />
    <circle cx="12" cy="5" r="1.6" fill="currentColor" />
    <circle cx="19" cy="5" r="1.6" fill="currentColor" />
    <circle cx="5" cy="12" r="1.6" fill="currentColor" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    <circle cx="5" cy="19" r="1.6" fill="currentColor" />
    <circle cx="12" cy="19" r="1.6" fill="currentColor" />
    <circle cx="19" cy="19" r="1.6" fill="currentColor" />
  </svg>
);
const IconBackSmall = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconStar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.8 5.5 21l2-7.5L2 9h7z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const QUICK_APPS = [
  { name: "Inbox", url: "https://mail.google.com/mail/", color: "#ea4335" },
  { name: "Drive", url: "https://drive.google.com/", color: "#1a73e8" },
  { name: "Photos", url: "https://photos.google.com/", color: "#fbbc04" },
  { name: "Keep", url: "https://keep.google.com/", color: "#f2b807" },
  { name: "Docs", url: "https://docs.google.com/", color: "#4285f4" },
  { name: "Chat", url: "https://chat.google.com/", color: "#34a853" },
  { name: "Maps", url: "https://maps.google.com/", color: "#ea4335" },
];

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
  const [panel, setPanel] = useState(null); // 'profile' | 'vpn' | 'more' | 'apps' | 'tabs' | 'downloads' | 'bookmarks' | 'history' | 'manageProfile' | null
  const [toast, setToast] = useState("");
  const [vpnConnected, setVpnConnected] = useState(false);
  const [vpnConnecting, setVpnConnecting] = useState(false);
  const [downloads, setDownloads] = useState([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [pageBookmarked, setPageBookmarked] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfileState] = useState(null);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // login | register
  const [registerStep, setRegisterStep] = useState(1);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [emailStatus, setEmailStatus] = useState("idle");
  const [dob, setDob] = useState("");
  const [countryCode, setCountryCode] = useState(COUNTRIES[0].dial);
  const [mobileNumber, setMobileNumber] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [devOtpCode, setDevOtpCode] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [activateId, setActivateId] = useState(null);
  const [activatePassword, setActivatePassword] = useState("");


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
      const title = hostnameOf(url);
      setDraft(displayUrl(url));

      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeId) return t;
          const base = (t.history || []).slice(0, (t.histIndex ?? -1) + 1);
          const history = [...base, url];
          return {
            ...t,
            url,
            title,
            history,
            histIndex: history.length - 1,
          };
        })
      );

      closePanels();
      if (!incognito) {
        recordHistory(title, url).catch(() => {});
      }
      await openUrl(url, { incognito, tabCount: tabs.length });
    },
    [active?.incognito, activeId, closePanels, tabs.length]
  );

  useEffect(() => {
    setDraft(displayUrl(active?.url || ""));
    if (!active?.url || active?.incognito) {
      setPageBookmarked(false);
      return;
    }
    isBookmarked(active.url)
      .then(setPageBookmarked)
      .catch(() => setPageBookmarked(false));
  }, [active?.id, active?.url, active?.incognito]);

  const refreshProfiles = useCallback(async () => {
    setProfilesLoading(true);
    try {
      const [list, current] = await Promise.all([listProfiles(), getActiveProfile()]);
      setProfiles(list);
      setActiveProfileState(current);
    } catch {
      setProfiles([]);
      setActiveProfileState(null);
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  useEffect(() => {
    function onChromeAction(event) {
      const action = event?.detail?.action;
      if (!action) return;
      if (action === "home") {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeId
              ? {
                  ...t,
                  url: "",
                  title: t.incognito ? "Private Tab" : "New Tab",
                  history: [],
                  histIndex: -1,
                }
              : t
          )
        );
        setDraft("");
        setPanel(null);
      } else if (action === "bookmarks") {
        openBookmarksPanel();
      } else if (action === "search") {
        setPanel(null);
        window.setTimeout(() => {
          const input = document.getElementById("addressInput");
          if (input) {
            input.focus();
            input.select();
          }
        }, 50);
      } else if (action === "newtab") {
        const tab = newTab({ incognito: false });
        setTabs((prev) => [...prev, tab]);
        setActiveId(tab.id);
        setDraft("");
        setPanel(null);
      } else if (action === "tabs") {
        setPanel("tabs");
      } else if (action === "more") {
        setPanel("more");
      }
    }
    window.addEventListener("vinaru-chrome", onChromeAction);
    return () => window.removeEventListener("vinaru-chrome", onChromeAction);
  }, [activeId]);

  const profileInitial = (activeProfile?.displayName || "V")[0].toUpperCase();
  const profileColor = activeProfile?.avatarColor || "#3b7cf6";
  const profileLabel = activeProfile?.displayName || "Guest profile";
  const profileGreeting = activeProfile?.displayName
    ? `Hi, ${activeProfile.displayName.split(" ")[0]}!`
    : "Hi, Guest!";

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
      openUrl(url, { incognito: Boolean(active.incognito), tabCount: tabs.length });
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
    openUrl(url, { incognito: Boolean(active.incognito), tabCount: tabs.length });
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

  async function openDownloadsPanel() {
    setPanel("downloads");
    setDownloadsLoading(true);
    try {
      const items = await listDownloads();
      setDownloads(items);
    } catch {
      setDownloads([]);
      showToast("Could not load downloads");
    } finally {
      setDownloadsLoading(false);
    }
  }

  async function handleOpenDownload(id) {
    try {
      await openDownload(id);
    } catch (err) {
      showToast(err?.message || "Could not open file");
    }
  }

  async function handleOpenDownloadsFolder() {
    try {
      await openDownloadsFolder();
      closePanels();
    } catch {
      showToast("Could not open Downloads folder");
    }
  }

  async function openBookmarksPanel() {
    setLibraryQuery("");
    setPanel("bookmarks");
    setLibraryLoading(true);
    try {
      setBookmarks(await listBookmarks());
    } catch {
      setBookmarks([]);
      showToast("Could not load bookmarks");
    } finally {
      setLibraryLoading(false);
    }
  }

  async function openHistoryPanel() {
    setLibraryQuery("");
    setPanel("history");
    setLibraryLoading(true);
    try {
      setHistoryItems(await listHistory(""));
    } catch {
      setHistoryItems([]);
      showToast("Could not load history");
    } finally {
      setLibraryLoading(false);
    }
  }

  async function refreshHistory(query = libraryQuery) {
    setLibraryLoading(true);
    try {
      setHistoryItems(await listHistory(query));
    } catch {
      setHistoryItems([]);
    } finally {
      setLibraryLoading(false);
    }
  }

  async function toggleBookmark() {
    if (!active?.url) {
      showToast("Open a page to bookmark it");
      return;
    }
    if (active.incognito) {
      showToast("Bookmarks are disabled in private tabs");
      return;
    }
    try {
      if (pageBookmarked) {
        const items = await listBookmarks();
        const match = items.find((b) => b.url === active.url);
        if (match) await removeBookmark(match.id);
        setPageBookmarked(false);
        showToast("Bookmark removed");
      } else {
        await addBookmark(active.title || hostnameOf(active.url), active.url);
        setPageBookmarked(true);
        showToast("Bookmark saved");
      }
      if (panel === "bookmarks") {
        setBookmarks(await listBookmarks());
      }
    } catch {
      showToast("Could not update bookmark");
    }
  }

  async function openManageProfile() {
    setAuthMode("login");
    setRegisterStep(1);
    setAuthError("");
    setLoginId("");
    setLoginPassword("");
    setFirstName("");
    setLastName("");
    setUsername("");
    setEmailStatus("idle");
    setDob("");
    setCountryCode(COUNTRIES[0].dial);
    setMobileNumber("");
    setOtpSent(false);
    setOtpCode("");
    setDevOtpCode("");
    setRegPassword("");
    setRegConfirm("");
    setActivateId(null);
    setActivatePassword("");
    setPanel("manageProfile");
    await refreshProfiles();
  }

  useEffect(() => {
    if (panel !== "manageProfile" || authMode !== "register" || registerStep !== 2 || !username) {
      if (!username) setEmailStatus("idle");
      return undefined;
    }
    setEmailStatus("checking");
    const timer = window.setTimeout(() => {
      checkEmailAvailable(`${normalizeUsername(username)}${EMAIL_DOMAIN}`)
        .then((available) => setEmailStatus(available ? "available" : "taken"))
        .catch(() => setEmailStatus("error"));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [username, authMode, registerStep, panel]);

  async function persistAccount(result) {
    const user = result.user || {};
    await saveAccountProfile({
      id: `local-${user.email}`,
      type: "local",
      email: user.email,
      displayName: user.displayName || user.email,
      avatarColor: user.avatarColor,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      createdAt: user.createdAt || Date.now(),
    });
    await refreshProfiles();
  }

  async function handleLoginSubmit(e) {
    e?.preventDefault?.();
    setAuthBusy(true);
    setAuthError("");
    try {
      const email = toVinaruEmail(loginId);
      const result = await loginAccount({ email, password: loginPassword });
      await persistAccount(result);
      setLoginPassword("");
      showToast("Signed in");
      setPanel("profile");
    } catch (err) {
      setAuthError(err?.message || "Login failed");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRegisterNext(e) {
    e?.preventDefault?.();
    setAuthError("");
    if (registerStep === 1) {
      if (!firstName.trim()) {
        setAuthError("First name is required");
        return;
      }
      setRegisterStep(2);
      return;
    }
    if (registerStep === 2) {
      const user = normalizeUsername(username);
      if (!user) {
        setAuthError("Username is required");
        return;
      }
      if (emailStatus === "taken") {
        setAuthError("That email is already taken");
        return;
      }
      if (emailStatus === "checking") return;
      setRegisterStep(3);
      return;
    }
    if (registerStep === 3) {
      const mobile = `${countryCode}${mobileNumber.replace(/\D/g, "")}`;
      if (!dob) {
        setAuthError("Date of birth is required");
        return;
      }
      if (!mobileNumber.trim()) {
        setAuthError("Mobile number is required");
        return;
      }
      if (!otpSent) {
        setAuthBusy(true);
        try {
          const result = await sendOtp(mobile);
          setOtpSent(true);
          setDevOtpCode(result.devCode || "");
        } catch (err) {
          setAuthError(err?.message || "Could not send code");
        } finally {
          setAuthBusy(false);
        }
        return;
      }
      setAuthBusy(true);
      try {
        await verifyOtp(mobile, otpCode.trim());
        setRegisterStep(4);
      } catch (err) {
        setAuthError(err?.message || "Invalid code");
      } finally {
        setAuthBusy(false);
      }
      return;
    }
    if (registerStep === 4) {
      if (!isPasswordValid(regPassword)) {
        setAuthError(passwordHint());
        return;
      }
      if (regPassword !== regConfirm) {
        setAuthError("Passwords don't match");
        return;
      }
      setAuthBusy(true);
      try {
        const displayName = [firstName, lastName].map((s) => s.trim()).filter(Boolean).join(" ");
        const email = `${normalizeUsername(username)}${EMAIL_DOMAIN}`;
        const mobile = `${countryCode}${mobileNumber.replace(/\D/g, "")}`;
        const result = await registerAccount({
          email,
          password: regPassword,
          displayName,
          dob,
          mobile,
        });
        await persistAccount(result);
        showToast("Account created");
        setPanel("profile");
      } catch (err) {
        setAuthError(err?.message || "Registration failed");
      } finally {
        setAuthBusy(false);
      }
    }
  }

  async function handleSelectProfile(id) {
    const profile = profiles.find((p) => p.id === id);
    if (profile?.signedOut && profile.email) {
      setActivateId(id);
      setActivatePassword("");
      setAuthError("");
      return;
    }
    try {
      await setActiveProfile(id);
      await refreshProfiles();
      showToast("Profile switched");
    } catch {
      showToast("Could not switch profile");
    }
  }

  async function handleActivateProfile(e) {
    e?.preventDefault?.();
    const profile = profiles.find((p) => p.id === activateId);
    if (!profile?.email) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      const result = await loginAccount({ email: profile.email, password: activatePassword });
      await persistAccount(result);
      setActivateId(null);
      setActivatePassword("");
      showToast("Profile activated");
    } catch (err) {
      setAuthError(err?.message || "Incorrect password");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRemoveProfile(id) {
    try {
      await removeProfile(id);
      await refreshProfiles();
      showToast("Profile removed");
    } catch {
      showToast("Could not remove profile");
    }
  }

  async function handleSignOutProfile() {
    try {
      await clearActiveProfile();
      await refreshProfiles();
      showToast("Signed out of profile");
      setPanel("profile");
    } catch {
      showToast("Could not sign out");
    }
  }

  const filteredBookmarks = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase();
    if (!q) return bookmarks;
    return bookmarks.filter(
      (b) => (b.title || "").toLowerCase().includes(q) || (b.url || "").toLowerCase().includes(q)
    );
  }, [bookmarks, libraryQuery]);

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
            className={`top-icon-btn ${pageBookmarked ? "starred" : ""}`}
            onClick={toggleBookmark}
            title="Bookmark"
            aria-label="Bookmark"
          >
            <IconStar />
          </button>
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
            <span className="avatar" style={{ background: profileColor }}>
              {profileInitial}
            </span>
          </button>
        </div>
      </div>

      {panel === "profile" ? (
        <div className="popup panel-top-right" role="dialog" aria-label="Profile">
          <div className="popup-header">
            <span>{profileLabel}</span>
            <button type="button" className="popup-close" onClick={closePanels}>
              ×
            </button>
          </div>
          <div className="popup-body profile-body">
            <span className="avatar large" style={{ background: profileColor }}>
              {profileInitial}
            </span>
            <div className="profile-greeting">{profileGreeting}</div>
            <button type="button" className="popup-primary" onClick={openManageProfile}>
              Manage profile
            </button>
          </div>
          <div className="popup-list">
            <button type="button" onClick={() => { addTab(true); }}>
              <IconIncognito />
              <span>New private tab</span>
            </button>
            {activeProfile ? (
              <button type="button" onClick={handleSignOutProfile}>
                <span>Sign out</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {panel === "manageProfile" ? (
        <div className="popup panel-top-right manage-profile-popup" role="dialog" aria-label="Manage profile">
          <div className="popup-header">
            <button type="button" className="popup-back" onClick={() => setPanel("profile")} aria-label="Back">
              <IconBackSmall />
            </button>
            <span>Manage profile</span>
            <button type="button" className="popup-close" onClick={closePanels}>
              ×
            </button>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={authMode === "login" ? "active" : ""}
              onClick={() => {
                setAuthMode("login");
                setAuthError("");
                setRegisterStep(1);
              }}
            >
              Login
            </button>
            <button
              type="button"
              className={authMode === "register" ? "active" : ""}
              onClick={() => {
                setAuthMode("register");
                setAuthError("");
                setRegisterStep(1);
              }}
            >
              Create account
            </button>
          </div>

          {authMode === "login" ? (
            <form className="auth-form" onSubmit={handleLoginSubmit}>
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Email or username"
                autoCapitalize="off"
                autoCorrect="off"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Password"
              />
              {authError ? <div className="auth-error">{authError}</div> : null}
              <button type="submit" className="popup-primary" disabled={authBusy || !loginId || !loginPassword}>
                {authBusy ? "Signing in…" : "Login"}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegisterNext}>
              <div className="auth-step">Step {registerStep} of 4</div>
              {registerStep === 1 ? (
                <>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name *" />
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
                </>
              ) : null}
              {registerStep === 2 ? (
                <>
                  <input
                    value={username}
                    onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                    placeholder="Username *"
                    autoCapitalize="off"
                  />
                  <div className="auth-hint">
                    {username ? `${normalizeUsername(username)}${EMAIL_DOMAIN}` : `you${EMAIL_DOMAIN}`}
                    {emailStatus === "checking" ? " · checking…" : ""}
                    {emailStatus === "available" ? " · available" : ""}
                    {emailStatus === "taken" ? " · taken" : ""}
                  </div>
                </>
              ) : null}
              {registerStep === 3 ? (
                <>
                  <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
                  <div className="mobile-row">
                    <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                      {COUNTRIES.map((c) => (
                        <option key={c.iso} value={c.dial}>
                          {c.iso} {c.dial}
                        </option>
                      ))}
                    </select>
                    <input
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ""))}
                      placeholder="Mobile number *"
                      inputMode="tel"
                    />
                  </div>
                  {otpSent ? (
                    <>
                      <input
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="Verification code"
                        inputMode="numeric"
                      />
                      {devOtpCode ? <div className="auth-hint">Dev code: {devOtpCode}</div> : null}
                    </>
                  ) : null}
                </>
              ) : null}
              {registerStep === 4 ? (
                <>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Password *"
                  />
                  <input
                    type="password"
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    placeholder="Confirm password *"
                  />
                  <div className="auth-hint">{passwordHint()}</div>
                </>
              ) : null}
              {authError ? <div className="auth-error">{authError}</div> : null}
              <div className="auth-actions">
                {registerStep > 1 ? (
                  <button
                    type="button"
                    className="sheet-action"
                    onClick={() => {
                      setAuthError("");
                      if (registerStep === 3) {
                        setOtpSent(false);
                        setOtpCode("");
                        setDevOtpCode("");
                      }
                      setRegisterStep((s) => s - 1);
                    }}
                  >
                    Back
                  </button>
                ) : (
                  <span />
                )}
                <button type="submit" className="popup-primary" disabled={authBusy}>
                  {authBusy
                    ? "Please wait…"
                    : registerStep === 3 && !otpSent
                      ? "Send code"
                      : registerStep === 3
                        ? "Verify"
                        : registerStep === 4
                          ? "Create account"
                          : "Next"}
                </button>
              </div>
            </form>
          )}

          <div className="section-label">Your profiles</div>
          <div className="downloads-list">
            {profilesLoading ? <div className="downloads-empty">Loading…</div> : null}
            {!profilesLoading && profiles.length === 0 ? (
              <div className="downloads-empty">No accounts yet. Login or create one above.</div>
            ) : null}
            {!profilesLoading
              ? profiles.map((p) => {
                  const initial = (p.displayName || p.email || "?")[0].toUpperCase();
                  const isActive = activeProfile?.id === p.id;
                  return (
                    <div key={p.id} className={`library-row ${isActive ? "active-profile" : ""}`}>
                      <button type="button" className="library-main profile-pick" onClick={() => handleSelectProfile(p.id)}>
                        <span className="avatar sm" style={{ background: p.avatarColor || "#3b7cf6" }}>
                          {initial}
                        </span>
                        <span className="profile-pick-text">
                          <span className="download-name">{p.displayName || "Account"}</span>
                          <span className="download-meta">
                            {p.email || "Local"}
                            {isActive ? " · Active" : p.signedOut ? " · Signed out" : ""}
                          </span>
                        </span>
                      </button>
                      <button type="button" className="library-remove" onClick={() => handleRemoveProfile(p.id)}>
                        Remove
                      </button>
                    </div>
                  );
                })
              : null}
          </div>

          {activateId ? (
            <form className="auth-form activate-form" onSubmit={handleActivateProfile}>
              <div className="section-label">Enter password to activate</div>
              <input
                type="password"
                value={activatePassword}
                onChange={(e) => setActivatePassword(e.target.value)}
                placeholder="Password"
              />
              {authError ? <div className="auth-error">{authError}</div> : null}
              <div className="auth-actions">
                <button type="button" className="sheet-action" onClick={() => setActivateId(null)}>
                  Cancel
                </button>
                <button type="submit" className="popup-primary" disabled={authBusy || !activatePassword}>
                  {authBusy ? "…" : "Activate"}
                </button>
              </div>
            </form>
          ) : null}
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
            <button type="button" onClick={() => { openBookmarksPanel(); }}>Bookmarks</button>
            <button type="button" onClick={() => { openHistoryPanel(); }}>History</button>
          </div>
          <div className="popup-list">
            <button type="button" onClick={() => { addTab(false); }}>New tab</button>
            <button type="button" onClick={() => { addTab(true); }}>New private tab</button>
            <button type="button" onClick={() => { setPanel("apps"); }}>
              <IconApps />
              <span>Apps</span>
            </button>
            <button type="button" onClick={() => { setPanel("tabs"); }}>Tabs ({tabs.length})</button>
            <button type="button" onClick={() => { openDownloadsPanel(); }}>Downloads</button>
            <button type="button" onClick={() => { showToast("Settings coming soon"); closePanels(); }}>Settings</button>
            <button
              type="button"
              className="menu-nav-item"
              disabled={!canGoBack}
              onClick={() => {
                goBack();
              }}
            >
              <IconBack />
              <span>Previous page</span>
            </button>
            <button
              type="button"
              className="menu-nav-item"
              disabled={!canGoForward}
              onClick={() => {
                goForward();
              }}
            >
              <IconForward />
              <span>Next page</span>
            </button>
          </div>
        </div>
      ) : null}

      {panel === "bookmarks" ? (
        <div className="popup panel-bottom-right downloads-popup" role="dialog" aria-label="Bookmarks">
          <div className="popup-header">
            <button type="button" className="popup-back" onClick={() => setPanel("more")} aria-label="Back">
              <IconBackSmall />
            </button>
            <span>Bookmarks</span>
            <button type="button" className="popup-close" onClick={closePanels}>
              ×
            </button>
          </div>
          <div className="library-search">
            <input
              value={libraryQuery}
              onChange={(e) => setLibraryQuery(e.target.value)}
              placeholder="Search bookmarks"
            />
            <button
              type="button"
              className="sheet-action"
              onClick={toggleBookmark}
              disabled={!active?.url || active?.incognito}
            >
              {pageBookmarked ? "Remove current" : "Add current"}
            </button>
          </div>
          <div className="downloads-list">
            {libraryLoading ? <div className="downloads-empty">Loading…</div> : null}
            {!libraryLoading && filteredBookmarks.length === 0 ? (
              <div className="downloads-empty">No bookmarks yet. Tap the star to save a page.</div>
            ) : null}
            {!libraryLoading
              ? filteredBookmarks.map((b) => (
                  <div key={b.id} className="library-row">
                    <button type="button" className="library-main" onClick={() => navigate(b.url)}>
                      <span className="download-name">{b.title || hostnameOf(b.url)}</span>
                      <span className="download-meta">{displayUrl(b.url)}</span>
                    </button>
                    <button
                      type="button"
                      className="library-remove"
                      onClick={async () => {
                        await removeBookmark(b.id);
                        setBookmarks(await listBookmarks());
                        if (active?.url === b.url) setPageBookmarked(false);
                        showToast("Bookmark removed");
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              : null}
          </div>
        </div>
      ) : null}

      {panel === "history" ? (
        <div className="popup panel-bottom-right downloads-popup" role="dialog" aria-label="History">
          <div className="popup-header">
            <button type="button" className="popup-back" onClick={() => setPanel("more")} aria-label="Back">
              <IconBackSmall />
            </button>
            <span>History</span>
            <button type="button" className="popup-close" onClick={closePanels}>
              ×
            </button>
          </div>
          <div className="library-search">
            <input
              value={libraryQuery}
              onChange={(e) => {
                const value = e.target.value;
                setLibraryQuery(value);
                refreshHistory(value);
              }}
              placeholder="Search history"
            />
          </div>
          <div className="downloads-toolbar">
            <button type="button" className="sheet-action" onClick={() => clearHistory("hour").then(() => refreshHistory())}>
              Clear hour
            </button>
            <button type="button" className="sheet-action" onClick={() => clearHistory("day").then(() => refreshHistory())}>
              Clear day
            </button>
            <button
              type="button"
              className="sheet-action danger-text"
              onClick={() => clearHistory("all").then(() => refreshHistory())}
            >
              Clear all
            </button>
          </div>
          <div className="downloads-list">
            {libraryLoading ? <div className="downloads-empty">Loading…</div> : null}
            {!libraryLoading && historyItems.length === 0 ? (
              <div className="downloads-empty">No browsing history yet.</div>
            ) : null}
            {!libraryLoading
              ? historyItems.map((h) => (
                  <div key={h.id} className="library-row">
                    <button type="button" className="library-main" onClick={() => navigate(h.url)}>
                      <span className="download-name">{h.title || hostnameOf(h.url)}</span>
                      <span className="download-meta">
                        {displayUrl(h.url)}
                        {h.visitedAt ? ` · ${new Date(h.visitedAt).toLocaleString()}` : ""}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="library-remove"
                      onClick={async () => {
                        await removeHistory(h.id);
                        await refreshHistory();
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              : null}
          </div>
        </div>
      ) : null}

      {panel === "apps" ? (
        <div className="popup panel-bottom-right apps-popup" role="dialog" aria-label="Apps">
          <div className="popup-header">
            <button type="button" className="popup-back" onClick={() => setPanel("more")} aria-label="Back">
              <IconBackSmall />
            </button>
            <span>Apps</span>
            <button type="button" className="popup-close" onClick={closePanels}>
              ×
            </button>
          </div>
          <div className="apps-grid">
            {QUICK_APPS.map((app) => (
              <button
                key={app.url}
                type="button"
                className="app-tile"
                onClick={() => navigate(app.url)}
              >
                <span className="app-tile-icon" style={{ background: app.color }}>
                  {app.name[0]}
                </span>
                <span>{app.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {panel === "downloads" ? (
        <div className="popup panel-bottom-right downloads-popup" role="dialog" aria-label="Downloads">
          <div className="popup-header">
            <button type="button" className="popup-back" onClick={() => setPanel("more")} aria-label="Back">
              <IconBackSmall />
            </button>
            <span>Downloads</span>
            <button type="button" className="popup-close" onClick={closePanels}>
              ×
            </button>
          </div>
          <div className="downloads-toolbar">
            <button type="button" className="sheet-action" onClick={openDownloadsPanel}>
              Refresh
            </button>
            <button type="button" className="sheet-action" onClick={handleOpenDownloadsFolder}>
              Open folder
            </button>
          </div>
          <div className="downloads-list">
            {downloadsLoading ? <div className="downloads-empty">Loading…</div> : null}
            {!downloadsLoading && downloads.length === 0 ? (
              <div className="downloads-empty">No downloads yet. Files you download in Vinaru will show here.</div>
            ) : null}
            {!downloadsLoading
              ? downloads.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="download-row"
                    onClick={() => handleOpenDownload(d.id)}
                    disabled={d.state !== "completed"}
                  >
                    <span className="download-name">{d.filename || "File"}</span>
                    <span className="download-meta">{d.state || "queued"}</span>
                  </button>
                ))
              : null}
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
                  if (tab.url) {
                    openUrl(tab.url, { incognito: Boolean(tab.incognito), tabCount: tabs.length });
                  }
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
        <button type="button" className="bottom-btn" onClick={goHome} title="Home" aria-label="Home">
          <IconHome />
        </button>
        <button
          type="button"
          className={`bottom-btn ${pageBookmarked ? "starred" : ""} ${panel === "bookmarks" ? "active" : ""}`}
          onClick={() => openBookmarksPanel()}
          title="Bookmarks"
          aria-label="Bookmarks"
        >
          <IconBookmark />
        </button>
        <button type="button" className="bottom-btn" onClick={focusAddress} title="Search" aria-label="Search">
          <IconSearch />
        </button>
        <button type="button" className="bottom-btn" onClick={() => addTab(false)} title="New tab" aria-label="New tab">
          <IconPlus />
        </button>
        <button
          type="button"
          className={`bottom-btn tabs-count-btn ${panel === "tabs" ? "active" : ""}`}
          onClick={() => togglePanel("tabs")}
          title="Tabs"
          aria-label={`Tabs, ${tabs.length} open`}
        >
          <span className="tabs-count">{tabs.length}</span>
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
