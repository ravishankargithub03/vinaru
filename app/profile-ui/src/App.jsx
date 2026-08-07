import { useEffect, useState } from "react";
import "./App.css";
import { COUNTRIES } from "./countries";

function Req() {
  return <span className="required-mark">*</span>;
}

// Electron wraps thrown IPC errors as "Error invoking remote method 'x': Error: <message>" —
// strip that boilerplate so the renderer shows only the actual, human-written message.
function describeError(e, fallback) {
  let message = (e && e.message) || "";
  message = message.replace(/^Error invoking remote method '[^']*':\s*/, "");
  message = message.replace(/^(Error:\s*)+/, "");
  return message || fallback;
}

function PasswordInput({ value, onChange, ...rest }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input type={visible ? "text" : "password"} value={value} onChange={onChange} {...rest} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

function Avatar({ profile, size = 40 }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (profile.picture) {
    return <img className="avatar" style={style} src={profile.picture} alt="" />;
  }
  return (
    <div className="avatar" style={{ ...style, background: profile.avatarColor || "#3b7cf6" }}>
      {(profile.displayName || profile.email || "?")[0].toUpperCase()}
    </div>
  );
}

const EMAIL_DOMAIN = "@vinaru.com";
const CHECK_DEBOUNCE_MS = 250;
const TOTAL_STEPS = 4;

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 25;
const SPECIAL_CHARS = ".@#$&*-_+%!";
const SPECIAL_REGEX = /[.@#$&*\-_+%!]/;

function passwordRules(pw) {
  return {
    length: pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: SPECIAL_REGEX.test(pw),
  };
}

function isPasswordValid(pw) {
  return Object.values(passwordRules(pw)).every(Boolean);
}

function normalizeUsername(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/@.*$/, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function slug(word) {
  return word.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function randomDigits(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

const SUGGESTIONS_WANTED = 3;

// A pool of candidates to try, richest/most natural first — we check them in order and
// keep only the ones that are actually available, so the user never sees a taken suggestion.
function buildSuggestionPool(firstName, lastName) {
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

export default function App() {
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [registerStep, setRegisterStep] = useState(1); // 1: name, 2: username, 3: dob+mobile+otp, 4: password

  const [loginId, setLoginId] = useState("");

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");

  const [username, setUsername] = useState("");
  const [emailStatus, setEmailStatus] = useState("idle"); // idle | checking | available | taken | error
  const [suggestions, setSuggestions] = useState([]); // available usernames only
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const [dob, setDob] = useState("");
  const [countryCode, setCountryCode] = useState(COUNTRIES[0].dial);
  const [mobileNumber, setMobileNumber] = useState("");
  const mobile = `${countryCode}${mobileNumber.replace(/\D/g, "")}`;
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [devOtpCode, setDevOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [welcomeName, setWelcomeName] = useState("");
  const [welcomeEmail, setWelcomeEmail] = useState("");

  const [activatingId, setActivatingId] = useState(null);
  const [activatePassword, setActivatePassword] = useState("");
  const [activateBusy, setActivateBusy] = useState(false);
  const [activateError, setActivateError] = useState("");

  function resetRegisterState() {
    setRegisterStep(1);
    setFirstName("");
    setMiddleName("");
    setLastName("");
    setUsername("");
    setEmailStatus("idle");
    setSuggestions([]);
    setSuggestionsLoading(false);
    setDob("");
    setCountryCode(COUNTRIES[0].dial);
    setMobileNumber("");
    setOtpSent(false);
    setOtpCode("");
    setDevOtpCode("");
    setPassword("");
    setConfirmPassword("");
  }

  function switchMode(next) {
    setMode(next);
    resetRegisterState();
    setWelcomeName("");
    setWelcomeEmail("");
    setError("");
  }

  function refresh() {
    window.attach.profiles.list().then(setProfiles);
    window.attach.profiles.getActive().then((p) => setActiveId(p?.id ?? null));
  }

  useEffect(() => {
    refresh();
  }, []);

  // Live-check the typed username as the user enters each character.
  useEffect(() => {
    if (mode !== "register" || registerStep !== 2 || !username) {
      setEmailStatus("idle");
      return;
    }
    setEmailStatus("checking");
    const timer = setTimeout(() => {
      window.attach.profiles
        .checkEmail(`${username}${EMAIL_DOMAIN}`)
        .then((available) => setEmailStatus(available ? "available" : "taken"))
        .catch(() => setEmailStatus("error"));
    }, CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [username, mode, registerStep]);

  // Offer suggested Vinaru emails based on the name, as soon as the username step opens.
  // Only ever show ones we've confirmed are actually available.
  useEffect(() => {
    if (mode !== "register" || registerStep !== 2) return;
    const pool = buildSuggestionPool(firstName, lastName);
    let cancelled = false;
    setSuggestions([]);
    setSuggestionsLoading(pool.length > 0);

    (async () => {
      const available = [];
      for (const candidate of pool) {
        if (cancelled || available.length >= SUGGESTIONS_WANTED) break;
        try {
          const isAvailable = await window.attach.profiles.checkEmail(`${candidate}${EMAIL_DOMAIN}`);
          if (isAvailable) available.push(candidate);
        } catch {
          // skip candidates we couldn't check
        }
      }
      if (!cancelled) {
        setSuggestions(available);
        setSuggestionsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, registerStep]);

  function goBack() {
    setError("");
    if (registerStep === 3) {
      setOtpSent(false);
      setOtpCode("");
      setDevOtpCode("");
    }
    setRegisterStep(registerStep - 1);
  }

  function handleOtpStep() {
    setError("");

    if (!otpSent) {
      setOtpBusy(true);
      window.attach.profiles
        .sendOtp(mobile.trim())
        .then((result) => {
          setOtpSent(true);
          setDevOtpCode(result.devCode || "");
        })
        .catch((e) => setError(describeError(e, "Could not send verification code")))
        .finally(() => setOtpBusy(false));
      return;
    }

    setOtpBusy(true);
    window.attach.profiles
      .verifyOtp(mobile.trim(), otpCode.trim())
      .then(() => setRegisterStep(4))
      .catch((e) => setError(describeError(e, "Invalid code")))
      .finally(() => setOtpBusy(false));
  }

  function handleResendOtp() {
    setError("");
    setOtpBusy(true);
    window.attach.profiles
      .sendOtp(mobile.trim())
      .then((result) => {
        setDevOtpCode(result.devCode || "");
        setOtpCode("");
      })
      .catch((e) => setError(describeError(e, "Could not resend code")))
      .finally(() => setOtpBusy(false));
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (mode === "login" || mode === "welcome") {
      setBusy(true);
      setError("");
      window.attach.profiles
        .login(loginId.trim().includes("@") ? loginId.trim() : `${normalizeUsername(loginId)}${EMAIL_DOMAIN}`, password)
        .then(() => {
          setLoginId("");
          setPassword("");
          setWelcomeName("");
          setWelcomeEmail("");
          setMode("login");
          refresh();
        })
        .catch((e) => setError(describeError(e, "Something went wrong")))
        .finally(() => setBusy(false));
      return;
    }

    // register mode
    if (registerStep === 1) {
      setError("");
      setRegisterStep(2);
      return;
    }
    if (registerStep === 2) {
      setError("");
      setRegisterStep(3);
      return;
    }
    if (registerStep === 3) {
      handleOtpStep();
      return;
    }

    // registerStep === 4
    if (!isPasswordValid(password)) {
      setError(
        `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters and include a lowercase letter, an uppercase letter, a number, and a special character (${SPECIAL_CHARS})`
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setBusy(true);
    setError("");
    const displayName = [firstName, middleName, lastName].map((s) => s.trim()).filter(Boolean).join(" ");
    const newEmail = `${normalizeUsername(username)}${EMAIL_DOMAIN}`;
    window.attach.profiles
      .register(newEmail, password, displayName, dob, mobile.trim())
      .then(() => {
        resetRegisterState();
        setWelcomeName(displayName);
        setWelcomeEmail(newEmail);
        setLoginId(newEmail);
        setMode("welcome");
        refresh();
      })
      .catch((e) => setError(describeError(e, "Something went wrong")))
      .finally(() => setBusy(false));
  }

  function removeProfile(id, event) {
    event.stopPropagation();
    window.attach.profiles.remove(id).then(refresh);
  }

  // Profiles that are still signed in (just not the current one) switch instantly —
  // only a profile that was explicitly signed out needs its password re-entered.
  function switchProfile(id, event) {
    event.stopPropagation();
    window.attach.profiles.setActive(id).then(refresh);
  }

  function startActivate(id, event) {
    event.stopPropagation();
    setActivatingId(id);
    setActivatePassword("");
    setActivateError("");
  }

  function cancelActivate() {
    setActivatingId(null);
    setActivatePassword("");
    setActivateError("");
  }

  function confirmActivate(email, e) {
    e.preventDefault();
    e.stopPropagation();
    setActivateBusy(true);
    setActivateError("");
    window.attach.profiles
      .login(email, activatePassword)
      .then(() => {
        setActivatingId(null);
        setActivatePassword("");
        refresh();
      })
      .catch((err) => setActivateError(describeError(err, "Incorrect password")))
      .finally(() => setActivateBusy(false));
  }

  const nextDisabled =
    busy ||
    (registerStep === 2 && (!username || emailStatus === "checking" || emailStatus === "taken")) ||
    (registerStep === 3 && otpBusy) ||
    (registerStep === 4 && (!isPasswordValid(password) || (Boolean(confirmPassword) && confirmPassword !== password)));

  return (
    <div className="page">
      <h1>Profiles</h1>
      <p className="subtitle">Switch between Vinaru accounts, or create a new one.</p>

      <div className="section-title">Your profiles</div>
      {profiles.length === 0 ? (
        <div className="empty-note">No profiles yet — add one below.</div>
      ) : (
        <div className="profile-list">
          {profiles.map((p) => (
            <div key={p.id}>
              <div className={"profile-row" + (p.id === activeId ? " active" : "")}>
                <Avatar profile={p} />
                <div className="profile-main">
                  <div className="profile-name">{p.displayName}</div>
                  <div className="profile-sub">
                    {p.email}
                    <span className="badge">Vinaru</span>
                  </div>
                </div>
                {p.id === activeId ? (
                  <span className="badge active-badge">Active</span>
                ) : p.signedOut ? (
                  <button type="button" className="activate-btn" onClick={(e) => startActivate(p.id, e)}>
                    Activate
                  </button>
                ) : (
                  <button type="button" className="activate-btn" onClick={(e) => switchProfile(p.id, e)}>
                    Switch
                  </button>
                )}
                <button className="remove-btn" onClick={(e) => removeProfile(p.id, e)}>
                  Remove
                </button>
              </div>
              {activatingId === p.id && (
                <form className="activate-form" onSubmit={(e) => confirmActivate(p.email, e)}>
                  <div className="field">
                    <label>Enter password for {p.email}</label>
                    <PasswordInput
                      value={activatePassword}
                      onChange={(e) => setActivatePassword(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                  {activateError && <div className="error-text">{activateError}</div>}
                  <div className="step-actions">
                    <button type="button" className="secondary-btn" onClick={cancelActivate}>
                      Cancel
                    </button>
                    <button type="submit" className="primary-btn" disabled={activateBusy}>
                      Confirm
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {mode === "welcome" ? (
        <>
          <div className="section-title">Welcome</div>
          <p className="subtitle">
            Welcome, {welcomeName}! Your account <strong>{welcomeEmail}</strong> has been created — log in below to
            continue.
          </p>
        </>
      ) : (
        <>
          <div className="section-title">Add a profile</div>
          <div className="add-tabs">
            <button className={"add-tab" + (mode === "login" ? " selected" : "")} onClick={() => switchMode("login")}>
              Log in
            </button>
            <button
              className={"add-tab" + (mode === "register" ? " selected" : "")}
              onClick={() => switchMode("register")}
            >
              Create account
            </button>
          </div>
        </>
      )}

      {mode === "register" && (
        <div className="step-indicator">
          Step {registerStep} of {TOTAL_STEPS}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {mode === "register" ? (
          <>
            {registerStep === 1 && (
              <>
                <div className="field">
                  <label>First name<Req /></label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus required />
                </div>
                <div className="field">
                  <label>Middle name (optional)</label>
                  <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
                </div>
                <div className="field">
                  <label>Last name<Req /></label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </>
            )}

            {registerStep === 2 && (
              <div className="field">
                <label>Choose your Vinaru email<Req /></label>
                <div className="email-combo">
                  <input
                    value={username}
                    onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                    placeholder="username"
                    autoFocus
                    required
                  />
                  <span className="email-domain">{EMAIL_DOMAIN}</span>
                </div>
                {username && (
                  <div className={"email-status " + emailStatus}>
                    {emailStatus === "checking" && "Checking availability…"}
                    {emailStatus === "available" && `${username}${EMAIL_DOMAIN} is available`}
                    {emailStatus === "taken" && `${username}${EMAIL_DOMAIN} is already taken`}
                    {emailStatus === "error" && "Couldn't check availability"}
                  </div>
                )}
                {(suggestionsLoading || suggestions.length > 0) && (
                  <div className="suggestions">
                    <div className="suggestions-label">Suggestions</div>
                    {suggestionsLoading ? (
                      <div className="email-status checking">Finding available suggestions…</div>
                    ) : (
                      <div className="suggestion-chips">
                        {suggestions.map((s) => (
                          <button type="button" key={s} className="suggestion-chip" onClick={() => setUsername(s)}>
                            {s}
                            {EMAIL_DOMAIN}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {registerStep === 3 && (
              <>
                <div className="field">
                  <label>Date of birth<Req /></label>
                  <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} disabled={otpSent} required />
                </div>
                <div className="field">
                  <label>Mobile number<Req /></label>
                  <div className="mobile-combo">
                    <select
                      className="country-select"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      disabled={otpSent}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.iso} value={c.dial}>
                          {c.name} ({c.dial})
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="555 123 4567"
                      disabled={otpSent}
                      autoFocus
                      required
                    />
                  </div>
                </div>
                {otpSent && (
                  <div className="field">
                    <label>Enter verification code<Req /></label>
                    <input
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="6-digit code"
                      maxLength={6}
                      autoFocus
                      required
                    />
                    {devOtpCode && (
                      <div className="email-status checking">
                        No SMS provider configured — dev code: <strong>{devOtpCode}</strong>
                      </div>
                    )}
                    <button type="button" className="link-btn" onClick={handleResendOtp} disabled={otpBusy}>
                      Resend code
                    </button>
                  </div>
                )}
              </>
            )}

            {registerStep === 4 && (
              <>
                <div className="field">
                  <label>Create password<Req /></label>
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={PASSWORD_MIN}
                    maxLength={PASSWORD_MAX}
                    autoFocus
                    required
                  />
                  {password && (
                    <ul className="password-rules">
                      {[
                        [passwordRules(password).length, `${PASSWORD_MIN}-${PASSWORD_MAX} characters`],
                        [passwordRules(password).lower, "a lowercase letter"],
                        [passwordRules(password).upper, "an uppercase letter"],
                        [passwordRules(password).number, "a number"],
                        [passwordRules(password).special, `a special character (${SPECIAL_CHARS})`],
                      ].map(([met, label]) => (
                        <li key={label} className={met ? "met" : "unmet"}>
                          {label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="field">
                  <label>Re-enter password<Req /></label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={PASSWORD_MIN}
                    maxLength={PASSWORD_MAX}
                    required
                  />
                  {confirmPassword && (
                    <div className={"email-status " + (confirmPassword === password ? "available" : "taken")}>
                      {confirmPassword === password ? "Passwords match" : "Passwords don't match"}
                    </div>
                  )}
                </div>
              </>
            )}

            {error && <div className="error-text">{error}</div>}
            <div className="step-actions">
              {registerStep > 1 && (
                <button type="button" className="secondary-btn" onClick={goBack}>
                  Back
                </button>
              )}
              <button className="primary-btn" type="submit" disabled={nextDisabled}>
                {registerStep === 3 ? "Verify" : registerStep < 4 ? "Next" : "Create account"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label>Email or username<Req /></label>
              <input value={loginId} onChange={(e) => setLoginId(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password<Req /></label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="primary-btn" type="submit" disabled={busy}>
              Log in
            </button>
          </>
        )}
      </form>
    </div>
  );
}
