import { sendSms } from "./sms.js";

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const VERIFIED_TTL_MS = 15 * 60 * 1000;

const pendingOtps = new Map<string, OtpEntry>();
const verifiedMobiles = new Map<string, number>();

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendOtp(mobile: string) {
  const code = generateCode();
  pendingOtps.set(mobile, { code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
  const { real } = await sendSms(mobile, code);
  return real ? {} : { devCode: code };
}

export function verifyOtp(mobile: string, code: string) {
  const entry = pendingOtps.get(mobile);
  if (!entry) return { error: "No verification code was requested for this number" as const };

  if (Date.now() > entry.expiresAt) {
    pendingOtps.delete(mobile);
    return { error: "Code expired — request a new one" as const };
  }

  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    pendingOtps.delete(mobile);
    return { error: "Too many attempts — request a new code" as const };
  }

  if (entry.code !== code) return { error: "Incorrect code" as const };

  pendingOtps.delete(mobile);
  verifiedMobiles.set(mobile, Date.now() + VERIFIED_TTL_MS);
  return { verified: true as const };
}

export function isMobileVerified(mobile: string) {
  const expiresAt = verifiedMobiles.get(mobile);
  return typeof expiresAt === "number" && Date.now() < expiresAt;
}

export function consumeMobileVerification(mobile: string) {
  verifiedMobiles.delete(mobile);
}
