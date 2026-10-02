import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import { setAuthSession } from "../utils/auth";
import { loginUser as loginUserApi } from "../services/authApi";
import { useToast } from "../contexts/ToastContext";
import { LOGIN_SUCCESS } from "../utils/successMessages";
import { getFriendlyMessage } from "../utils/errorMessages";

const IconEnvelope = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);
const IconLock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconEye = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

function getLoginFieldMessage(rawMessage, field, status) {
  const msg = String(rawMessage || "").toLowerCase();
  if (field === "email" || msg.includes("email")) {
    if (msg.includes("required") || msg.includes("missing") || msg.includes("empty")) return "Email address is required.";
    if (msg.includes("invalid") || msg.includes("valid")) return "Please enter a valid email address.";
  }
  if (field === "password" || msg.includes("password")) {
    if (msg.includes("required") || msg.includes("missing") || msg.includes("empty")) return "Password is required.";
    if (msg.includes("length") || msg.includes("short")) return "Password looks too short.";
  }
  if (Number(status) === 401 || msg.includes("unauthorized") || msg.includes("invalid email or password")) {
    return "Email or password is incorrect.";
  }
  return getFriendlyMessage(status, rawMessage, "login");
}

function Login() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const next = { email: "", password: "" };
    const rawEmail = String(emailInputRef.current?.value ?? email ?? "").trim();
    // Autofill can sometimes include stray whitespace; remove all internal whitespace before validating.
    const emailValue = rawEmail.replace(/\s+/g, "").toLowerCase();
    if (emailValue && emailValue !== email) setEmail(emailValue);
    const pass = String(passwordInputRef.current?.value ?? password ?? "");
    if (!emailValue) next.email = "Email address is required.";
    // NOTE: Don't double-escape in regex literals; this must use \s and \. (not \\s / \\.)
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) next.email = "Please enter a valid email address.";
    if (!pass) next.password = "Password is required.";
    setErrors(next);
    if (next.email || next.password) return;

    setSubmitting(true);
    try {
      const data = await loginUserApi({ email: emailValue, password: pass });
      const token = data.token ?? data.accessToken;
      if (!token || !data.user) {
        setError("The server did not return a valid session. Please try again or contact support.");
        return;
      }
      const rawRole = (data.user?.userType ?? data.user?.role ?? "").toString().toLowerCase();
      const role = rawRole === "buyer" ? "buyer" : "seller";
      setAuthSession(token, { ...data.user, userType: role, role });
      showToast(LOGIN_SUCCESS);
      const path = role === "buyer" ? "/buyer/dashboard" : "/seller/dashboard";
      setTimeout(() => navigate(path), 600);
    } catch (err) {
      const status = err && typeof err.status === "number" ? err.status : null;
      const raw = err instanceof Error ? err.message : "Login failed.";
      setError(getFriendlyMessage(status, raw, "login"));
      if (err.details && Array.isArray(err.details)) {
        const next = { email: "", password: "" };
        err.details.forEach((d) => {
          const field = d.field;
          const friendly = getLoginFieldMessage(d.message || "", field, status);
          if (field === "email") next.email = friendly;
          else if (field === "password") next.password = friendly;
        });
        setErrors(next);
      }
      // Wrong credentials often come without per-field details; still show field-level feedback.
      if ((status === 401 || status === 403) && !(err.details && Array.isArray(err.details) && err.details.length)) {
        const msg = getLoginFieldMessage(raw, undefined, status);
        setErrors({ email: msg, password: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="register-page login-page">
        <div className="auth-card-container">
          <div className="register-page-left">
            <Link to="/" className="register-logo">
          <img src={ecoLoopLogo} alt="EcoLoop" />
        </Link>
        <div className="register-hero">
          <h1 className="register-headline">Turn Waste into Opportunity</h1>
          <p className="register-desc">
            Connect, trade, and grow sustainably with verified eco-businesses. Join the circular economy today.
          </p>
        </div>
          </div>
        </div>

        <div className="auth-card-container">
          <div className="register-page-right">
            <div className="register-card login-card">
          <h2 className="login-card-title">Welcome Back</h2>
          <p className="register-card-subtitle">Sign in to your account</p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="register-form-errors login-form-error" role="alert">
                {error}
              </div>
            )}
            <label className="register-field">
              <span className="register-field-label">Email Address</span>
              <span className="register-input-wrap">
                <span className="register-input-icon" aria-hidden="true"><IconEnvelope /></span>
                <input
                  ref={emailInputRef}
                  type="email"
                  name="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); setErrors((p) => ({ ...p, email: "" })); }}
                  onBlur={(e) => { setEmail(e.target.value); }}
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "login-email-error" : undefined}
                />
              </span>
              {errors.email && <span id="login-email-error" className="register-field-error">{errors.email}</span>}
        </label>

            <div className="register-field">
              <span className="register-field-label">Password</span>
              <span className="register-input-wrap">
                <span className="register-input-icon" aria-hidden="true"><IconLock /></span>
                <input
                  id="login-password"
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); setErrors((p) => ({ ...p, password: "" })); }}
                  onBlur={(e) => { setPassword(e.target.value); }}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "login-password-error" : undefined}
                />
                <button
                  type="button"
                  className="register-password-toggle"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword((p) => !p);
                  }}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </span>
              {errors.password && <span id="login-password-error" className="register-field-error">{errors.password}</span>}
            </div>

            <div className="login-forgot-wrap">
              <Link to="/forgot-password" className="login-forgot-link">Forgot Password?</Link>
            </div>

            <button type="submit" className="register-submit login-submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="register-signin login-signup">
            Don't have an account? <Link to="/register" className="register-signin-link">Sign Up</Link>
          </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
