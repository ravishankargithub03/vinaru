import { Capacitor } from "@capacitor/core";

const EMAIL_DOMAIN = "@vinaru.com";
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 25;
const SPECIAL_REGEX = /[.@#$&*\-_+%!]/;

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

function accountsBaseUrl() {
  if (import.meta.env.VITE_ACCOUNTS_URL) return import.meta.env.VITE_ACCOUNTS_URL.replace(/\/$/, "");
  // Android emulator reaches host machine localhost via 10.0.2.2
  if (Capacitor.getPlatform() === "android") return "http://10.0.2.2:4200";
  return "http://localhost:4200";
}

async function api(path, options = {}) {
  const res = await fetch(`${accountsBaseUrl()}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
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
