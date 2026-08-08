import { Capacitor, registerPlugin } from "@capacitor/core";

const VinaruBrowser = registerPlugin("VinaruBrowser");

export function resolveInput(raw) {
  const input = (raw || "").trim();
  if (!input) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) return input;
  if (/^localhost(:\d+)?(\/.*)?$/i.test(input)) return "http://" + input;
  if (!/\s/.test(input) && /\.[a-zA-Z]{2,}(\/.*)?$/.test(input)) return "https://" + input;
  return "https://www.google.com/search?q=" + encodeURIComponent(input);
}

/** Open URL inside Vinaru (native WebView) — never hand off to Chrome/other browsers. */
export async function openUrl(url) {
  if (!url) return;

  if (!Capacitor.isNativePlatform()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  await VinaruBrowser.open({ url });
}

export async function closeBrowser() {
  // BrowserActivity is closed with its Home / system back when history is empty.
}
