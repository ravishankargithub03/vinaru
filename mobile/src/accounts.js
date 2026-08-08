import { Capacitor } from "@capacitor/core";

const EMAIL_DOMAIN = "@vinaru.com";
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 25;
const SPECIAL_REGEX = /[.@#$&*\-_+%!]/;
const STORAGE_KEY = "vinaru_accounts_base";
const REQUEST_TIMEOUT_MS = 4000;

export const COUNTRIES = [
  { iso: "IN", name: "India", dial: "+91" },
  { iso: "US", name: "United States", dial: "+1" },
  { iso: "GB", name: "United Kingdom", dial: "+44" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971" },
  { iso: "AU", name: "Australia", dial: "+61" },
  { iso: "CA", name: "Canada", dial: "+1" },
  { iso: "DE", name: "Germany", dial: "+49" },
  { iso: "SG", name: "Singapore", dial: "+65" },
  { iso: "PK", name: "Pakistan", dial: "+92" },
  { iso: "BD", name: "Bangladesh", dial: "+880" },
];

let resolvedBase = "";
let resolvePromise = null;

function candidateBases() {
  const list = [];
  const push = (url) => {
    const clean = String(url || "").trim().replace(/\/$/, "");
    if (clean && !list.includes(clean)) list.push(clean);
  };

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) push(saved);
  } catch {
    /* ignore */
  }

  if (import.meta.env.VITE_ACCOUNTS_URL) push(import.meta.env.VITE_ACCOUNTS_URL);

  const extra = String(import.meta.env.VITE_ACCOUNTS_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  extra.forEach(push);

  if (Capacitor.getPlatform() === "android") {
    push("http://10.0.2.2:4200"); // Android emulator → host loopback
    push("http://localhost:4200");
  } else {
    push("http://localhost:4200");
  }
  return list;
}

async function probeBase(base) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 1500);
  try {
    const res = await fetch(`${base}/health`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`health ${res.status}`);
    return true;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveAccountsBase() {
  if (resolvedBase) return resolvedBase;
  if (resolvePromise) return resolvePromise;

  resolvePromise = (async () => {
    const candidates = candidateBases();
    for (const base of candidates) {
      try {
        await probeBase(base);
        resolvedBase = base;
        try {
          localStorage.setItem(STORAGE_KEY, base);
        } catch {
          /* ignore */
        }
        return base;
      } catch {
        /* try next */
      }
    }
    // Fall back to first candidate so errors are actionable
    resolvedBase = candidates[0] || "http://localhost:4200";
    return resolvedBase;
  })();

  try {
    return await resolvePromise;
  } finally {
    resolvePromise = null;
  }
}

async function api(path, options = {}) {
  const base = await resolveAccountsBase();
  const { headers: optionHeaders, signal: _ignored, ...rest } = options;

  async function doFetch(urlBase) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(`${urlBase}${path}`, {
        ...rest,
        headers: { "Content-Type": "application/json", ...(optionHeaders || {}) },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  let res;
  try {
    res = await doFetch(base);
  } catch (err) {
    resolvedBase = "";
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const retryBase = await resolveAccountsBase();
    try {
      res = await doFetch(retryBase);
    } catch {
      throw new Error(err?.name === "AbortError" ? "Accounts server timed out" : "Cannot reach accounts server");
    }
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/@.*$/, "")
    .replace(/[^a-z0-9._-]/g, "");
}

export function slug(word) {
  return String(word || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function randomDigits(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

const SUGGESTIONS_WANTED = 3;

/** Same suggestion pool as Windows profile-ui. */
export function buildSuggestionPool(firstName, lastName) {
  const first = slug(firstName);
  const last = slug(lastName);
  if (!first) return [];
  const pool = last
    ? [
        `${first}${last}`,
        `${first}.${last}`,
        `${first}_${last}`,
        `${first[0]}${last}`,
        `${first}${last}${randomDigits(2)}`,
        `${first}.${last}${randomDigits(2)}`,
        `${first}${last}${randomDigits(3)}`,
        `${first}${randomDigits(4)}`,
      ]
    : [
        first,
        `${first}${randomDigits(2)}`,
        `${first}${randomDigits(3)}`,
        `${first}.${randomDigits(2)}`,
        `${first}_${randomDigits(2)}`,
        `${first}${randomDigits(4)}`,
      ];
  return [...new Set(pool)];
}

export { SUGGESTIONS_WANTED };

export function toVinaruEmail(loginId) {
  const raw = String(loginId || "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw.toLowerCase();
  return `${normalizeUsername(raw)}${EMAIL_DOMAIN}`;
}

export function passwordRules(pw) {
  return {
    length: pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: SPECIAL_REGEX.test(pw),
  };
}

export function isPasswordValid(pw) {
  return Object.values(passwordRules(pw)).every(Boolean);
}

export function passwordHint() {
  return `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters and include lowercase, uppercase, a number, and a special character (.@#$&*-_+%!)`;
}

export async function checkEmailAvailable(email) {
  const data = await api(`/auth/check-email?email=${encodeURIComponent(email)}`);
  return Boolean(data.available);
}

export async function sendOtp(mobile) {
  return api("/auth/otp/send", { method: "POST", body: JSON.stringify({ mobile }) });
}

export async function verifyOtp(mobile, code) {
  return api("/auth/otp/verify", { method: "POST", body: JSON.stringify({ mobile, code }) });
}

export async function registerAccount({ email, password, displayName, dob, mobile }) {
  return api("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName, dob, mobile }),
  });
}

export async function loginAccount({ email, password }) {
  return api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export { EMAIL_DOMAIN, PASSWORD_MIN, PASSWORD_MAX };
