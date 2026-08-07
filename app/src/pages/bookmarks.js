const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const searchInput = document.getElementById("searchInput");

let allBookmarks = [];

function render(filterText) {
  const filtered = !filterText
    ? allBookmarks
    : allBookmarks.filter(
        (b) => b.title.toLowerCase().includes(filterText.toLowerCase()) || b.url.toLowerCase().includes(filterText.toLowerCase())
      );

  listEl.innerHTML = "";
  emptyEl.style.display = filtered.length === 0 ? "block" : "none";

  filtered.forEach((b) => {
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
    row.querySelector(".row-title").textContent = b.title;
    row.querySelector(".row-sub").textContent = b.url;
    row.querySelector(".row-main").addEventListener("click", () => window.attach.nav.goSelf(b.url));
    row.querySelector('[data-action="remove"]').addEventListener("click", (e) => {
      e.stopPropagation();
      window.attach.bookmarks.remove(b.id).then(load);
    });
    listEl.appendChild(row);
  });
}

function load() {
  window.attach.bookmarks.list().then((bookmarks) => {
    allBookmarks = bookmarks;
    render(searchInput.value.trim());
  });
}

searchInput.addEventListener("input", () => render(searchInput.value.trim()));

load();
