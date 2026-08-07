const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const searchInput = document.getElementById("searchInput");

function formatTime(ts) {
  return new Date(ts).toLocaleString();
}

function render(entries) {
  listEl.innerHTML = "";
  emptyEl.style.display = entries.length === 0 ? "block" : "none";

  entries
    .sort((a, b) => b.visitedAt - a.visitedAt)
    .forEach((h) => {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <div class="row-main">
          <div class="row-title"></div>
          <div class="row-sub"></div>
        </div>
        <div class="row-actions">
          <button class="danger" data-action="remove">Remove</button>
        </div>
      `;
      row.querySelector(".row-title").textContent = h.title;
      row.querySelector(".row-sub").textContent = `${h.url} — ${formatTime(h.visitedAt)} — visited ${h.visitCount}×`;
      row.querySelector(".row-main").addEventListener("click", () => window.attach.nav.goSelf(h.url));
      row.querySelector('[data-action="remove"]').addEventListener("click", (e) => {
        e.stopPropagation();
        window.attach.history.removeEntry(h.id).then(load);
      });
      listEl.appendChild(row);
    });
}

function load() {
  const q = searchInput.value.trim();
  window.attach.history.list(q || undefined).then(render);
}

searchInput.addEventListener("input", load);
document.getElementById("clearHourBtn").addEventListener("click", () => window.attach.history.clear(60 * 60 * 1000).then(load));
document.getElementById("clearTodayBtn").addEventListener("click", () => window.attach.history.clear(24 * 60 * 60 * 1000).then(load));
document.getElementById("clearAllBtn").addEventListener("click", () => window.attach.history.clear("all").then(load));

load();
