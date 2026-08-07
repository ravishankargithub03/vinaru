const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");

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

function render(items) {
  listEl.innerHTML = "";
  emptyEl.style.display = items.length === 0 ? "block" : "none";

  [...items].reverse().forEach((d) => {
    const row = document.createElement("div");
    row.className = "row";
    const progress = d.totalBytes ? Math.round((d.receivedBytes / d.totalBytes) * 100) : 0;
    row.innerHTML = `
      <div class="row-main" style="cursor:default">
        <div class="row-title"></div>
        <div class="row-sub"></div>
      </div>
      <div class="row-actions">
        <button data-action="open">Open</button>
        <button data-action="folder">Show in folder</button>
      </div>
    `;
    row.querySelector(".row-title").textContent = d.filename;
    row.querySelector(".row-sub").textContent =
      d.state === "progressing"
        ? `${formatBytes(d.receivedBytes)} of ${formatBytes(d.totalBytes)} — ${progress}%`
        : `${d.state} — ${formatBytes(d.totalBytes)}`;
    row.querySelector('[data-action="open"]').addEventListener("click", () => window.attach.downloads.openFile(d.id));
    row.querySelector('[data-action="folder"]').addEventListener("click", () => window.attach.downloads.openFolder(d.id));
    listEl.appendChild(row);
  });
}

window.attach.downloads.list().then(render);
window.attach.downloads.onUpdated(render);
