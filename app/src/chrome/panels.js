// This script runs inside a dedicated, always-on-top WebContentsView that
// the main process positions/sizes to exactly match whichever panel below
// is visible. Unlike the old single-window chrome UI, this view never
// overlaps the active tab's content elsewhere, and the tab is never
// resized or detached to make room for it — so opening a panel never
// blanks out or reflows the page underneath.

const panels = {
  vpn: document.getElementById("vpnPanel"),
  profile: document.getElementById("profilePanel"),
  more: document.getElementById("morePanel"),
};

function currentOpenPanelEl() {
  return Object.values(panels).find((el) => el.classList.contains("open"));
}

function reportSize() {
  const el = currentOpenPanelEl();
  if (!el) {
    window.attach.ui.reportPanelSize(0, 0);
    return;
  }
  const rect = el.getBoundingClientRect();
  window.attach.ui.reportPanelSize(Math.ceil(rect.width), Math.ceil(rect.height));
}

new ResizeObserver(reportSize).observe(document.body);

function showPanel(name) {
  Object.entries(panels).forEach(([key, el]) => el.classList.toggle("open", key === name));
  if (name === "vpn") loadServers();
  if (name === "more") showMoreMainView();
  reportSize();
}

window.attach.ui.onShowPanel((name) => {
  if (!name) {
    Object.values(panels).forEach((el) => el.classList.remove("open"));
    return;
  }
  showPanel(name);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.attach.ui.closePanel();
});

document.querySelectorAll("[data-nav]").forEach((el) => {
  el.addEventListener("click", () => {
    window.attach.tabs.create(el.dataset.nav);
    window.attach.ui.closePanel();
  });
});

// ---- VPN ----
const vpnClose = document.getElementById("vpnClose");
const vpnStatusLabel = document.getElementById("vpnStatusLabel");
const vpnSimBadge = document.getElementById("vpnSimBadge");
const vpnConnectBtn = document.getElementById("vpnConnectBtn");
const vpnDetails = document.getElementById("vpnDetails");
const vpnDetailServer = document.getElementById("vpnDetailServer");
const vpnDetailIp = document.getElementById("vpnDetailIp");
const vpnDetailProtocol = document.getElementById("vpnDetailProtocol");
const vpnDetailSession = document.getElementById("vpnDetailSession");
const vpnDetailPing = document.getElementById("vpnDetailPing");
const vpnDetailSpeed = document.getElementById("vpnDetailSpeed");
const vpnDetailData = document.getElementById("vpnDetailData");
const vpnServersEl = document.getElementById("vpnServers");
const killSwitchToggle = document.getElementById("killSwitchToggle");
const vpnKillSwitchNote = document.getElementById("vpnKillSwitchNote");
const webrtcToggle = document.getElementById("webrtcToggle");
const dohToggle = document.getElementById("dohToggle");
const trackerToggle = document.getElementById("trackerToggle");
const httpsOnlyToggle = document.getElementById("httpsOnlyToggle");

let vpnServersCache = [];
let vpnStatus = { status: "disconnected" };
let sessionTimerInterval = null;

vpnClose.addEventListener("click", () => window.attach.ui.closePanel());

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function renderVpnServers() {
  vpnServersEl.innerHTML = "";
  vpnServersCache.forEach((server) => {
    const row = document.createElement("div");
    row.className = "vpn-server-row" + (vpnStatus.serverId === server.id ? " active" : "");
    row.innerHTML = `
      <div class="vpn-server-main">
        <span class="vpn-server-title">${server.city}, ${server.country}${server.isSimulated ? " (Simulated)" : ""}</span>
        <span class="vpn-server-sub">${server.latencyMs} ms · ${server.availableBandwidthMbps} Mbps free</span>
      </div>
    `;
    row.addEventListener("click", () => {
      if (vpnStatus.status === "disconnected") window.attach.vpn.connect(server.id);
    });
    vpnServersEl.appendChild(row);
  });
  reportSize();
}

function loadServers() {
  window.attach.vpn.listServers().then((servers) => {
    vpnServersCache = servers;
    renderVpnServers();
  });
}

function serverLabel(serverId) {
  const server = vpnServersCache.find((s) => s.id === serverId);
  return server ? `${server.city}, ${server.country}` : serverId || "-";
}

function renderVpnStatus() {
  const s = vpnStatus;

  if (s.status === "connected") {
    vpnStatusLabel.textContent = `Connected — ${serverLabel(s.serverId)}`;
    vpnSimBadge.style.display = s.isSimulated ? "inline" : "none";
    vpnConnectBtn.textContent = "Disconnect";
    vpnConnectBtn.classList.add("connected");
    vpnConnectBtn.disabled = false;
    vpnDetails.style.display = "flex";
    vpnDetailServer.textContent = serverLabel(s.serverId);
    vpnDetailIp.textContent = s.clientAddress || "-";
    vpnDetailProtocol.textContent = s.protocol || "-";
    vpnDetailPing.textContent = s.lastLatencyMs != null ? `${s.lastLatencyMs} ms` : "-";
    vpnDetailSpeed.textContent = `↑ ${formatBytes(s.bytesSent || 0)} / ↓ ${formatBytes(s.bytesReceived || 0)}`;
    vpnDetailData.textContent = formatBytes((s.bytesSent || 0) + (s.bytesReceived || 0));

    if (!sessionTimerInterval) {
      sessionTimerInterval = setInterval(() => {
        if (vpnStatus.connectedAt) {
          vpnDetailSession.textContent = formatDuration(Date.now() - vpnStatus.connectedAt);
        }
      }, 1000);
    }
  } else {
    if (sessionTimerInterval) {
      clearInterval(sessionTimerInterval);
      sessionTimerInterval = null;
    }
    vpnStatusLabel.textContent = s.status === "connecting" ? "Connecting…" : "Not connected";
    vpnSimBadge.style.display = "none";
    vpnConnectBtn.textContent = s.status === "connecting" ? "Connecting…" : "Connect";
    vpnConnectBtn.classList.remove("connected");
    vpnConnectBtn.disabled = s.status === "connecting" || s.status === "disconnecting";
    vpnDetails.style.display = "none";
  }

  killSwitchToggle.checked = Boolean(s.killSwitch);
  vpnKillSwitchNote.textContent =
    s.killSwitchAvailable === false ? "Requires administrator rights on this machine" : "";

  renderVpnServers();
}

vpnConnectBtn.addEventListener("click", () => {
  if (vpnStatus.status === "connected") {
    window.attach.vpn.disconnect().catch((err) => alert(err.message || "Disconnect failed"));
  } else if (vpnStatus.status === "disconnected") {
    window.attach.vpn.connect().catch((err) => alert(err.message || "Connect failed"));
  }
});

killSwitchToggle.addEventListener("change", () => {
  window.attach.vpn.setKillSwitch(killSwitchToggle.checked);
});

function loadPrivacySettings() {
  window.attach.vpn.getPrivacySettings().then((settings) => {
    webrtcToggle.checked = settings.webrtcLeakProtection;
    dohToggle.checked = settings.dnsOverHttps;
    trackerToggle.checked = settings.trackerBlocking;
    httpsOnlyToggle.checked = settings.httpsOnly;
  });
}

webrtcToggle.addEventListener("change", () =>
  window.attach.vpn.setPrivacySettings({ webrtcLeakProtection: webrtcToggle.checked })
);
dohToggle.addEventListener("change", () => window.attach.vpn.setPrivacySettings({ dnsOverHttps: dohToggle.checked }));
trackerToggle.addEventListener("change", () =>
  window.attach.vpn.setPrivacySettings({ trackerBlocking: trackerToggle.checked })
);
httpsOnlyToggle.addEventListener("change", () =>
  window.attach.vpn.setPrivacySettings({ httpsOnly: httpsOnlyToggle.checked })
);

window.attach.vpn.onStatusUpdated((status) => {
  vpnStatus = status;
  renderVpnStatus();
});

window.attach.vpn.getStatus().then((status) => {
  vpnStatus = status;
  renderVpnStatus();
});
loadPrivacySettings();

// ---- Profile ----
const profileClose = document.getElementById("profileClose");
const panelAvatarSlot = document.getElementById("panelAvatarSlot");
const profileHeaderLabel = document.getElementById("profileHeaderLabel");
const profileGreeting = document.getElementById("profileGreeting");
const signOutBtn = document.getElementById("signOutBtn");
const clearDataBtn = document.getElementById("clearDataBtn");

const DEFAULT_AVATAR_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="50" fill="#3b7cf6" />
  <circle cx="50" cy="34" r="21" fill="#2a2a2f" />
  <circle cx="50" cy="38" r="17" fill="#f2c19c" />
  <path d="M14,100 Q14,66 50,66 Q86,66 86,100 Z" fill="#e9e9ec" />
</svg>`;

profileClose.addEventListener("click", () => window.attach.ui.closePanel());

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderProfile(profile) {
  if (profile && profile.picture) {
    panelAvatarSlot.innerHTML = `<img src="${escapeHtml(profile.picture)}" alt="" />`;
  } else if (profile) {
    const initial = escapeHtml((profile.displayName || profile.email || "?")[0].toUpperCase());
    const color = profile.avatarColor || "#3b7cf6";
    panelAvatarSlot.innerHTML = `<div class="panel-avatar-initial" style="background:${escapeHtml(color)}">${initial}</div>`;
  } else {
    panelAvatarSlot.innerHTML = DEFAULT_AVATAR_SVG;
  }

  if (profile) {
    profileHeaderLabel.textContent = profile.email;
    profileGreeting.textContent = `Hi, ${(profile.displayName || profile.email).split(" ")[0]}!`;
    signOutBtn.style.display = "flex";
  } else {
    profileHeaderLabel.textContent = "Guest profile";
    profileGreeting.textContent = "Hi, Guest!";
    signOutBtn.style.display = "none";
  }
  reportSize();
}

signOutBtn.addEventListener("click", () => {
  window.attach.profiles.clearActive().then(() => {
    window.attach.ui.closePanel();
  });
});

renderProfile(null);
window.attach.profiles.getActive().then(renderProfile);
window.attach.profiles.onActiveChanged(renderProfile);

// ---- More menu ----
const moreClose = document.getElementById("moreClose");
const moreHeaderLabel = document.getElementById("moreHeaderLabel");
const moreMainView = document.getElementById("moreMainView");
const moreAppsView = document.getElementById("moreAppsView");
const appsMenuBtn = document.getElementById("appsMenuBtn");
const appsBackBtn = document.getElementById("appsBackBtn");

moreClose.addEventListener("click", () => window.attach.ui.closePanel());

clearDataBtn.addEventListener("click", () => {
  window.attach.history.clear("all").then(() => window.attach.ui.closePanel());
});

function showMoreMainView() {
  moreMainView.style.display = "";
  moreAppsView.style.display = "none";
  appsBackBtn.style.display = "none";
  moreHeaderLabel.textContent = "Menu";
  reportSize();
}

function showMoreAppsView() {
  moreMainView.style.display = "none";
  moreAppsView.style.display = "";
  appsBackBtn.style.display = "flex";
  moreHeaderLabel.textContent = "Apps";
  reportSize();
}

appsMenuBtn.addEventListener("click", showMoreAppsView);
appsBackBtn.addEventListener("click", showMoreMainView);
