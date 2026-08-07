import { Router } from "express";
import { register, login, refreshAccessToken, getUserById, requireAuth, isEmailTaken } from "../auth.js";
import { sendOtp, verifyOtp, isMobileVerified, consumeMobileVerification } from "../otp.js";

export const authRouter = Router();

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidMobile(mobile: string) {
  return /^\+?[1-9]\d{7,14}$/.test(mobile);
}

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 25;
const SPECIAL_CHARS = ".@#$&*-_+%!";
const SPECIAL_REGEX = /[.@#$&*\-_+%!]/;

function isValidPassword(password: string) {
  return (
    password.length >= PASSWORD_MIN &&
    password.length <= PASSWORD_MAX &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    SPECIAL_REGEX.test(password)
  );
}

authRouter.get("/check-email", (req, res) => {
  const email = String(req.query.email || "")
    .toLowerCase()
    .trim();
  if (!isValidEmail(email)) return res.status(400).json({ error: "Invalid email address" });
  res.json({ email, available: !isEmailTaken(email) });
});

authRouter.post("/otp/send", async (req, res) => {
  const { mobile } = req.body as { mobile?: string };
  if (!mobile || !isValidMobile(mobile)) return res.status(400).json({ error: "A valid mobile number is required" });

  const result = await sendOtp(mobile);
  res.json({ sent: true, ...result });
});

authRouter.post("/otp/verify", (req, res) => {
  const { mobile, code } = req.body as { mobile?: string; code?: string };
  if (!mobile || !code) return res.status(400).json({ error: "mobile and code are required" });

  const result = verifyOtp(mobile, code);
  if ("error" in result) return res.status(400).json(result);
  res.json(result);
});

authRouter.post("/register", (req, res) => {
  const { email, password, displayName, dob, mobile } = req.body as {
    email?: string;
    password?: string;
    displayName?: string;
    dob?: string;
    mobile?: string;
  };
  if (!email || !password || !displayName || !dob || !mobile) {
    return res.status(400).json({ error: "email, password, displayName, dob and mobile are required" });
  }
  if (!isValidEmail(email)) return res.status(400).json({ error: "Invalid email address" });
  if (!isValidPassword(password)) {
    return res.status(400).json({
      error: `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters and include a lowercase letter, an uppercase letter, a number, and a special character (${SPECIAL_CHARS})`,
    });
  }
  if (!isValidMobile(mobile)) return res.status(400).json({ error: "Invalid mobile number" });
  if (!isMobileVerified(mobile)) return res.status(400).json({ error: "Mobile number is not verified" });

  const result = register(email.toLowerCase().trim(), password, displayName.trim(), dob, mobile);
  if ("error" in result) return res.status(409).json({ error: result.error });
  consumeMobileVerification(mobile);
  res.status(201).json(result);
});

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const result = login(email.toLowerCase().trim(), password);
  if ("error" in result) return res.status(401).json({ error: result.error });
  res.json(result);
});

authRouter.post("/refresh", (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) return res.status(400).json({ error: "refreshToken is required" });

  const tokens = refreshAccessToken(refreshToken);
  if (!tokens) return res.status(401).json({ error: "Invalid or expired refresh token" });
  res.json(tokens);
});

authRouter.get("/me", requireAuth, (req: any, res) => {
  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});
