const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const SIZE = 512;

const html = `<!doctype html><html><body style="margin:0;width:${SIZE}px;height:${SIZE}px;overflow:hidden;background:transparent;display:flex;align-items:center;justify-content:center;">
  <div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:${SIZE * 1.05}px;line-height:1;color:#3b7cf6;">V</div>
</body></html>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: { offscreen: true },
  });

  let latest = null;
  win.webContents.on("paint", (_e, _dirty, image) => {
    latest = image;
  });

  await win.loadURL("data:text/html," + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 600));

  fs.writeFileSync(path.join(__dirname, "..", "build", "icon.png"), latest.toPNG());
  app.quit();
});
