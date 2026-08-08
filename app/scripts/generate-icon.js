const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const SIZE = 512;
const buildDir = path.join(__dirname, "..", "build");

const html = `<!doctype html><html><body style="margin:0;width:${SIZE}px;height:${SIZE}px;overflow:hidden;background:#0b0b0f;display:flex;align-items:center;justify-content:center;">
  <div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:${SIZE * 0.78}px;line-height:1;color:#3b7cf6;">V</div>
</body></html>`;

app.whenReady().then(async () => {
  try {
    fs.mkdirSync(buildDir, { recursive: true });
    const pngPath = path.join(buildDir, "icon.png");

    const win = new BrowserWindow({
      width: SIZE,
      height: SIZE,
      show: false,
      backgroundColor: "#0b0b0f",
      webPreferences: { offscreen: true },
    });

    await win.loadURL("data:text/html," + encodeURIComponent(html));
    await new Promise((r) => setTimeout(r, 800));

    let image = null;
    for (let i = 0; i < 10; i++) {
      image = await win.webContents.capturePage();
      if (image && !image.isEmpty()) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!image || image.isEmpty()) {
      if (!fs.existsSync(pngPath)) {
        throw new Error("Failed to capture icon and no existing icon.png found");
      }
      console.warn("Icon capture failed; reusing existing icon.png");
    } else {
      fs.writeFileSync(pngPath, image.toPNG());
      console.log("Wrote", pngPath);
    }
  } catch (err) {
    console.error(err);
    app.exit(1);
    return;
  }

  app.quit();
});
