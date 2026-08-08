import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

export function resolveInput(raw) {
  const input = (raw || "").trim();
  if (!input) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) return input;
  if (/^localhost(:\d+)?(\/.*)?$/i.test(input)) return "http://" + input;
  if (!/\s/.test(input) && /\.[a-zA-Z]{2,}(\/.*)?$/.test(input)) return "https://" + input;
  return "https://www.google.com/search?q=" + encodeURIComponent(input);
}

export async function openUrl(url) {
  if (!url) return;

  if (!Capacitor.isNativePlatform()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  await Browser.open({ url, toolbarColor: "#0b0b0f" });
}

export async function closeBrowser() {
  try {
    await Browser.close();
  } catch {
    /* ignore */
  }
}
