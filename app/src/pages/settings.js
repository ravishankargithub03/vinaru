const homepageInput = document.getElementById("homepage");
const searchEngineSelect = document.getElementById("searchEngine");
const themeSelect = document.getElementById("theme");
const saveBtn = document.getElementById("saveBtn");
const savedNote = document.getElementById("savedNote");

window.attach.settings.get().then((settings) => {
  homepageInput.value = settings.homepage;
  searchEngineSelect.value = settings.searchEngine;
  themeSelect.value = settings.theme;
});

saveBtn.addEventListener("click", () => {
  window.attach.settings
    .set({
      homepage: homepageInput.value.trim() || "attach://app/newtab.html",
      searchEngine: searchEngineSelect.value,
      theme: themeSelect.value,
    })
    .then(() => {
      savedNote.style.display = "inline";
      setTimeout(() => (savedNote.style.display = "none"), 1500);
    });
});
