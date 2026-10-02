import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import { registerUser } from "../services/authApi";
import { setAuthSession } from "../utils/auth";
import { getFriendlyMessage } from "../utils/errorMessages";
import { useToast } from "../contexts/ToastContext";
import { REGISTER_SUCCESS } from "../utils/successMessages";

const IconPerson = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
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
const IconLockOpen = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
  </svg>
);
const IconPhone = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const initialErrors = { fullName: "", email: "", phone: "", password: "", confirmPassword: "", agreeTerms: "", userType: "" };

const USER_ALREADY_EXISTS_MSG = "User already exists, please Sign in";

/** Map raw API/backend messages to user-friendly UI messages */
function getUserFriendlyMessage(rawMessage, field, status) {
  const msg = (rawMessage || "").toLowerCase();
  const f = String(field || "").trim();
  if (status === 409 || msg.includes("already exists") || msg.includes("user already exists")) return USER_ALREADY_EXISTS_MSG;
  // Field-specific mappings
  if (f === "email" || msg.includes("email")) {
    // Backend wording varies: "already exists", "in use", "already registered", "taken", etc.
    const looksLikeDuplicate =
      msg.includes("already") &&
      (msg.includes("exist") || msg.includes("in use") || msg.includes("registered") || msg.includes("used") || msg.includes("taken"));
    const looksLikeDuplicateAlt =
      msg.includes("exists") || msg.includes("exist") || msg.includes("in use") || msg.includes("taken") || msg.includes("already registered");
    if (looksLikeDuplicate || looksLikeDuplicateAlt) return USER_ALREADY_EXISTS_MSG;
    if (msg.includes("invalid") || msg.includes("valid")) return "Please enter a valid email address.";
    if (msg.includes("required")) return "Email address is required.";
  }
  if (f === "name" || msg.includes("name")) {
    if (msg.includes("required")) return "Full name is required.";
    if (msg.includes("length") || msg.includes("short")) return "Please enter your full name.";
  }
  if (f === "phone" || f === "phoneNumber" || msg.includes("phone")) {
    if (msg.includes("required")) return "Phone number is required.";
    if (msg.includes("invalid") || msg.includes("valid") || msg.includes("format")) return "Please enter a valid phone number in international format (e.g. +2348012345678).";
  }
  if (f === "password" || msg.includes("password")) {
    if (msg.includes("match") || msg.includes("confirm")) return "Passwords do not match.";
    if (msg.includes("length") || msg.includes("6") || msg.includes("minimum")) return "Password must be at least 6 characters.";
    if (msg.includes("uppercase") || msg.includes("capital")) return "Password must include at least one capital letter.";
    if (msg.includes("lowercase") || msg.includes("lower")) return "Password must include at least one lowercase letter.";
    if (msg.includes("special") || msg.includes("symbol") || msg.includes("character")) return "Password must include at least one special character (e.g. ! @ # $).";
    if (msg.includes("required")) return "Password is required.";
  }
  if (f === "confirmPassword") return "Passwords do not match. Please confirm your password.";
  if (f === "role" || f === "userType" || msg.includes("role") || msg.includes("usertype") || msg.includes("user type")) {
    return "Please select whether you are a Buyer or Seller/Producer.";
  }
  if (f === "termsAccepted" || msg.includes("terms") || msg.includes("accepted")) return "You must agree to the Terms and Conditions.";
  if (f === "username" || msg.includes("username")) {
    if (msg.includes("required")) return "Username is required.";
    if (msg.includes("invalid") || msg.includes("format")) return "Username can only contain letters and numbers (no spaces).";
  }
  // Generic API/status mappings (use shared friendly messages)
  if (msg.includes("409") || msg.includes("conflict")) return USER_ALREADY_EXISTS_MSG;
  if (msg.includes("403") || msg.includes("forbidden")) return "Registration isn't available right now. If this keeps happening, please contact support.";
  return getFriendlyMessage(status ?? null, rawMessage);
}

function Register() {
  const navigate = useNavigate();
  const showToast = useToast();
  const emailInputRef = useRef(null);
  const [userType, setUserType] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [errors, setErrors] = useState(initialErrors);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  const validate = () => {
    const next = { ...initialErrors };
    if (!fullName.trim()) next.fullName = "Full name is required.";
    const emailValue = String(emailInputRef.current?.value ?? email ?? "").trim();
    if (!emailValue) next.email = "Email address is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) next.email = "Please enter a valid email address.";
    if (!phone.trim()) next.phone = "Phone number is required.";
    else {
      const trimmed = phone.trim();
      const digitsOnly = trimmed.replace(/\D/g, "");
      const looksLikeE164 = /^\+\d{10,15}$/.test(trimmed.replace(/\s+/g, ""));
      if (!looksLikeE164 && digitsOnly.length < 10) next.phone = "Please enter a valid phone number (at least 10 digits).";
      else if (!looksLikeE164 && trimmed.startsWith("+")) next.phone = "Please enter a valid phone number in international format (e.g. +2348012345678).";
    }
    if (!userType) next.userType = "Please select Buyer or Seller/Producer.";
    if (!password) next.password = "Password is required.";
    else if (password.length < 6) next.password = "Password must be at least 6 characters.";
    else if (!/[A-Z]/.test(password)) next.password = "Password must include at least one capital letter.";
    else if (!/[a-z]/.test(password)) next.password = "Password must include at least one lowercase letter.";
    else if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) next.password = "Password must include at least one special character (e.g. ! @ # $).";
    if (!confirmPassword) next.confirmPassword = "Please confirm your password.";
    else if (password !== confirmPassword) next.confirmPassword = "Passwords do not match.";
    if (!agreeTerms) next.agreeTerms = "You must agree to the Terms and Conditions.";
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      const name = fullName.trim();
      const type = (userType || "").toString().toLowerCase() === "buyer" ? "buyer" : "seller";
      const username = name.toLowerCase().replace(/\s+/g, "");
      const emailValue = String(emailInputRef.current?.value ?? email ?? "").trim();
      if (emailValue && emailValue !== email) setEmail(emailValue);
      const data = await registerUser({
        name,
        email: emailValue,
        phone: phone.trim(),
        password,
        confirmPassword,
        role: type,
        username: username || emailValue.toLowerCase().split("@")[0],
        termsAccepted: agreeTerms,
      });
      setAuthSession(data.token, { ...data.user, userType: type, role: type, phone: phone.trim() });
      showToast(REGISTER_SUCCESS);
      const path = type === "buyer" ? "/buyer/dashboard" : "/seller/dashboard";
      setTimeout(() => navigate(path), 800);
    } catch (err) {
      const status = err && typeof err.status === "number" ? err.status : null;
      const rawMessage = err instanceof Error ? err.message : "Registration failed.";
      setApiError(getUserFriendlyMessage(rawMessage, undefined, status));
      if (!(err.details && Array.isArray(err.details) && err.details.length)) {
        // Some backends return a single message without field details (e.g. 409 user exists).
        const maybeEmailMsg = getUserFriendlyMessage(rawMessage, "email", status);
      if (maybeEmailMsg === USER_ALREADY_EXISTS_MSG) {
        setErrors((prev) => ({ ...prev, email: maybeEmailMsg }));
      }
      }
      if (err.details && Array.isArray(err.details)) {
        const next = { ...initialErrors };
        err.details.forEach((d) => {
          const field = d.field;
          const friendlyMsg = getUserFriendlyMessage(d.message || "", field, status);
          if (field === "name") next.fullName = friendlyMsg;
          else if (field === "email") next.email = friendlyMsg;
          else if (field === "phone" || field === "phoneNumber") next.phone = friendlyMsg;
          else if (field === "password") next.password = friendlyMsg;
          else if (field === "confirmPassword") next.confirmPassword = friendlyMsg;
          else if (field === "role" || field === "userType") next.userType = friendlyMsg;
          else if (field === "termsAccepted") next.agreeTerms = friendlyMsg;
        });
        setErrors((prev) => ({ ...prev, ...next }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="register-page">
        <div className="auth-card-container">
          <div className="register-page-left">
            <Link to="/" className="register-logo">
          <img src={ecoLoopLogo} alt="EcoLoop" />
        </Link>
        <div className="register-hero">
          <h1 className="register-headline">Turn Waste into Opportunity</h1>
          <p className="register-desc">
            Connect, trade, and grow sustainably with verified eco-businesses. Join the world's most trusted circular economy marketplace.
          </p>
        </div>
        <p className="register-footer">
          © 2026 EcoLoop Inc. • <Link to="/privacy">Privacy Policy</Link>
        </p>
          </div>
        </div>

        <div className="auth-card-container">
          <div className="register-page-right">
            <div className="register-card">
          <h2 className="register-card-title">Create Account</h2>
          <p className="register-card-subtitle">Join EcoLoop today</p>

          <form className="register-form" onSubmit={handleSubmit} noValidate>
            {(Object.values(errors).some(Boolean) || apiError) && (
              <div className="register-form-errors" role="alert">
                {apiError || "Please correct the errors below and try again."}
              </div>
            )}
            <label className="register-field">
              <span className="register-field-label">Full Name</span>
              <span className="register-input-wrap">
                <span className="register-input-icon" aria-hidden="true"><IconPerson /></span>
                <input
                  type="text"
                  name="fullName"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setErrors((err) => ({ ...err, fullName: "" })); setApiError(""); }}
                  aria-invalid={!!errors.fullName}
                  aria-describedby={errors.fullName ? "register-fullName-error" : undefined}
                />
              </span>
              {errors.fullName && <span id="register-fullName-error" className="register-field-error">{errors.fullName}</span>}
            </label>

            <label className="register-field">
              <span className="register-field-label">Email Address</span>
              <span className="register-input-wrap">
                <span className="register-input-icon" aria-hidden="true"><IconEnvelope /></span>
                <input
                  ref={emailInputRef}
                  type="email"
                  name="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((err) => ({ ...err, email: "" })); }}
                  onBlur={(e) => { setEmail(e.target.value); }}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "register-email-error" : undefined}
                />
              </span>
              {errors.email && <span id="register-email-error" className="register-field-error">{errors.email}</span>}
            </label>

            <label className="register-field">
              <span className="register-field-label">Phone Number <span className="register-required" aria-hidden="true">*</span></span>
              <span className="register-input-wrap">
                <span className="register-input-icon" aria-hidden="true"><IconPhone /></span>
                <input
                  type="tel"
                  name="phone"
                  placeholder="e.g. +234 800 000 0000"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setErrors((err) => ({ ...err, phone: "" })); setApiError(""); }}
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "register-phone-error" : undefined}
                  required
                />
              </span>
              {errors.phone && <span id="register-phone-error" className="register-field-error">{errors.phone}</span>}
            </label>

            <div className="register-field">
              <span className="register-field-label">I am a...</span>
              <div className="register-type-toggle">
                <button
                  type="button"
                  className={`register-type-btn ${userType === "buyer" ? "register-type-btn-active" : ""}`}
                  onClick={() => { setUserType("buyer"); setErrors((err) => ({ ...err, userType: "" })); }}
                >
                  Buyer
                </button>
                <button
                  type="button"
                  className={`register-type-btn ${userType === "seller" ? "register-type-btn-active" : ""}`}
                  onClick={() => { setUserType("seller"); setErrors((err) => ({ ...err, userType: "" })); }}
                >
                  Seller/Producer
                </button>
              </div>
              {errors.userType && <span className="register-field-error">{errors.userType}</span>}
            </div>

            <div className="register-field">
              <span className="register-field-label">Password</span>
              <p className="register-password-hint" aria-live="polite">
                Must include: a capital letter, a lowercase letter, and a special character (e.g. ! @ # $).
              </p>
              <span className="register-input-wrap">
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
                  {showPassword ? <IconLockOpen /> : <IconLock />}
                </button>
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((err) => ({ ...err, password: "" })); }}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "register-password-error" : undefined}
                />
              </span>
              {errors.password && <span id="register-password-error" className="register-field-error">{errors.password}</span>}
            </div>

            <div className="register-field">
              <span className="register-field-label">Confirm Password</span>
              <span className="register-input-wrap">
                <button
                  type="button"
                  className="register-password-toggle"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowConfirmPassword((p) => !p);
                  }}
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <IconLockOpen /> : <IconLock />}
                </button>
                <input
                  id="register-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setErrors((err) => ({ ...err, confirmPassword: "" })); }}
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={errors.confirmPassword ? "register-confirmPassword-error" : undefined}
                />
              </span>
              {errors.confirmPassword && <span id="register-confirmPassword-error" className="register-field-error">{errors.confirmPassword}</span>}
            </div>

            <label className="register-field register-terms-wrap">
              <input
                type="checkbox"
                name="agreeTerms"
                className="register-terms-checkbox"
                aria-describedby="register-terms-desc"
                checked={agreeTerms}
                onChange={(e) => { setAgreeTerms(e.target.checked); setErrors((err) => ({ ...err, agreeTerms: "" })); }}
                aria-invalid={!!errors.agreeTerms}
              />
              <span id="register-terms-desc" className="register-terms-label">
                I agree to the <Link to="/terms" className="register-terms-link">Terms and Conditions</Link>
              </span>
            </label>
            {errors.agreeTerms && <span className="register-field-error register-field-error-checkbox">{errors.agreeTerms}</span>}

            <button type="submit" className="register-submit" disabled={submitting}>
              {submitting ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="register-signin">
            Already have an account? <Link to="/login" className="register-signin-link">Sign In</Link>
          </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
