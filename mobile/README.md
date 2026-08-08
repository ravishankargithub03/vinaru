# Vinaru Android (Capacitor)

Android build of Vinaru using the same approach as Oryx (`demo-proj-source`):

**Vite + React UI → Capacitor → Android System WebView APK**

This is a mobile browser shell (address bar, tabs, Google search / URL navigation). It is **not** a full Chromium/Electron port.

Searching/opening links uses Vinaru’s own **in-app WebView** (`BrowserActivity`) with back/forward/reload — it does **not** open Chrome or another browser app.

## Setup (once)

```bash
cd mobile
npm install
npx cap add android
```

## Build APK

```bash
npm run build:apk
```

Output is copied to:

`../web/public/downloads/vinaru-1.0.0.apk`

## Dev UI (browser preview)

```bash
npm run dev
```

Opens the mobile chrome UI in a desktop browser (page opens use `window.open` outside native).
