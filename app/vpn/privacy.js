const { app } = require("electron");

// Small curated set of well-known tracker/analytics domains. Not a full
// EasyList/EasyPrivacy replacement, but genuinely functional blocking for
// the most common third-party trackers.
const TRACKER_DOMAINS = [
  "doubleclick.net",
  "google-analytics.com",
  "googletagmanager.com",
  "googlesyndication.com",
  "googleadservices.com",
  "adnxs.com",
  "scorecardresearch.com",
  "hotjar.com",
  "mixpanel.com",
  "segment.io",
  "connect.facebook.net",
  "amplitude.com",
  "criteo.com",
  "taboola.com",
  "outbrain.com",
];

function hostMatchesTracker(hostname) {
  return TRACKER_DOMAINS.some((domain) => hostname === domain || hostname.endsWith("." + domain));
}

// setWebRTCIPHandlingPolicy lives on WebContents, not Session — it must be
// applied to each tab individually (called from createTab in main.js).
function applyWebRTCPolicy(webContents, settings) {
  webContents.setWebRTCIPHandlingPolicy(settings.webrtcLeakProtection ? "disable_non_proxied_udp" : "default");
}

function applyPrivacySettings(session, settings) {
  // "secure" mode requires DoH and never falls back to plain DNS — if the
  // DoH endpoint is slow/unreachable on this network, every request stalls
  // waiting for it. "automatic" tries DoH opportunistically and falls back
  // quickly, which is also what Chrome itself defaults to.
  const hostResolverOptions = { secureDnsMode: settings.dnsOverHttps ? "automatic" : "off" };
  if (settings.dnsOverHttps) {
    hostResolverOptions.secureDnsServers = ["https://cloudflare-dns.com/dns-query"];
  }
  app.configureHostResolver(hostResolverOptions);

  session.webRequest.onBeforeRequest((details, callback) => {
    if (!settings.trackerBlocking && !settings.httpsOnly) {
      callback({});
      return;
    }

    let url;
    try {
      url = new URL(details.url);
    } catch {
      callback({});
      return;
    }

    if (settings.trackerBlocking && hostMatchesTracker(url.hostname)) {
      callback({ cancel: true });
      return;
    }

    if (
      settings.httpsOnly &&
      url.protocol === "http:" &&
      details.resourceType === "mainFrame" &&
      !url.hostname.match(/^(localhost|127\.|10\.|192\.168\.)/)
    ) {
      url.protocol = "https:";
      callback({ redirectURL: url.toString() });
      return;
    }

    callback({});
  });
}

module.exports = { applyPrivacySettings, applyWebRTCPolicy, TRACKER_DOMAINS };
