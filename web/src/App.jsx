import { useEffect, useState } from "react";
import "./App.css";

const MonitorIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="20" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="2" width="12" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DOWNLOADS = {
  windows: { href: "/downloads/vinaru-setup-1.0.0.exe", label: "Download for Windows" },
  linux: { href: "/downloads/vinaru-1.0.0-linux.zip", label: "Download for Linux" },
};

function detectPlatform() {
  const ua = navigator.userAgent;
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return "windows";
}

function Pill({ children, active, disabled, onClick }) {
  return (
    <button className={`pill ${active ? "pill-active" : ""}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export default function App() {
  const [platform, setPlatform] = useState("windows");

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const download = DOWNLOADS[platform];

  return (
    <main className="hero">
      <div className="logo" aria-hidden="true">V</div>

      <h1 className="title">Vinaru</h1>
      <p className="tagline">The web, without leaving your work.</p>

      <a className="download-btn" href={download.href} download>
        <DownloadIcon />
        <span>{download.label}</span>
      </a>
      <p className="download-hint">
        {platform === "linux"
          ? "Download, unzip, then run ./vinaru-browser to launch the browser."
          : "If Chrome warns, choose Keep. If Windows says “protected your PC”, click More info → Run anyway."}
      </p>

      <div className="platforms">
        <div className="platform-group">
          <div className="platform-label">
            <MonitorIcon />
            <span>DESKTOP</span>
          </div>
          <div className="pill-row">
            <Pill active={platform === "windows"} onClick={() => setPlatform("windows")}>
              Windows
            </Pill>
            <Pill disabled>
              macOS <span className="soon">soon</span>
            </Pill>
            <Pill active={platform === "linux"} onClick={() => setPlatform("linux")}>
              Linux
            </Pill>
          </div>
        </div>

        <div className="platform-group">
          <div className="platform-label">
            <PhoneIcon />
            <span>MOBILE</span>
          </div>
          <div className="pill-row">
            <Pill disabled>
              Android <span className="soon">soon</span>
            </Pill>
            <Pill disabled>
              iPhone <span className="soon">soon</span>
            </Pill>
          </div>
        </div>
      </div>
    </main>
  );
}
