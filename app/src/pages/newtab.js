const searchInput = document.getElementById("searchInput");
const shortcutsEl = document.getElementById("shortcuts");

const DEFAULT_SHORTCUTS = [
  { title: "Google", url: "https://www.google.com" },
  { title: "YouTube", url: "https://www.youtube.com" },
  { title: "Wikipedia", url: "https://www.wikipedia.org" },
  { title: "GitHub", url: "https://www.github.com" },
];

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && searchInput.value.trim()) {
    window.attach.nav.goSelf(searchInput.value.trim());
  }
});

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function renderShortcuts(sites) {
  shortcutsEl.innerHTML = "";
  sites.forEach((site) => {
    const el = document.createElement("div");
    el.className = "shortcut";
    el.innerHTML = `<div class="shortcut-icon">${(site.title || hostnameOf(site.url))[0].toUpperCase()}</div><span>${hostnameOf(site.url)}</span>`;
    el.addEventListener("click", () => window.attach.nav.goSelf(site.url));
    shortcutsEl.appendChild(el);
  });
}

window.attach.history.list().then((history) => {
  const topVisited = [...history].sort((a, b) => b.visitCount - a.visitCount).slice(0, 8);
  const seen = new Set(topVisited.map((h) => hostnameOf(h.url)));
  const combined = [...topVisited];
  for (const d of DEFAULT_SHORTCUTS) {
    if (combined.length >= 8) break;
    if (!seen.has(hostnameOf(d.url))) combined.push(d);
  }
  renderShortcuts(combined);
});
