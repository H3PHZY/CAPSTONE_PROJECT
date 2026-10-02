"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import type { AuthMode, SignupProfile } from "@/lib/auth-context";

export function AuthForm({
  mode,
  onModeChange,
  onSuccess,
  onForgotSubmit,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onSuccess: (email: string, password: string, signup?: SignupProfile) => Promise<void>;
  onForgotSubmit: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [business, setBusiness] = useState("");
  const [cluster, setCluster] = useState("Ogba");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [sells, setSells] = useState(true);
  const [buys, setBuys] = useState(true);
  const [carbonImpact, setCarbonImpact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isLogin = mode === "login";
  const isForgot = mode === "forgot";
  const isSignup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isSignup && !sells && !buys) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (isForgot) {
        await onForgotSubmit(email);
        setInfo("Check your email for a reset link. It may take a minute to arrive.");
        return;
      }
      await onSuccess(
        email,
        password,
        isSignup
          ? {
              businessName: business,
              cluster,
              phone,
              sells,
              buys,
              carbonImpact,
              researchConsent: consent,
            }
          : undefined
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authenticate");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {!isForgot ? (
        <div className="auth-tabs" role="tablist" aria-label="Account">
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            className={isLogin ? "auth-tab is-active" : "auth-tab"}
            onClick={() => {
              setError(null);
              setInfo(null);
              onModeChange("login");
            }}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignup}
            className={isSignup ? "auth-tab is-active" : "auth-tab"}
            onClick={() => {
              setError(null);
              setInfo(null);
              onModeChange("signup");
            }}
          >
            Sign up
          </button>
        </div>
      ) : null}

      <div className="auth-form-scroll">
        <p className="auth-lede">
          {isForgot
            ? "Enter the email on your EcoLoop account. We’ll send a link to set a new password."
            : isLogin
              ? "Sign in to browse listings, message buyers, and track your impact."
              : "Free during the pilot · agree price and payment in chat. You can sell, buy, or both."}
        </p>

        <div className="form-stack auth-form-fields">
          {isSignup ? (
            <>
              <div>
                <div className="field-label">What will you use EcoLoop for?</div>
                <div className="role-cards role-cards--compact">
                  <button
                    type="button"
                    className={sells ? "role-card is-selected" : "role-card"}
                    onClick={() => setSells((v) => !v)}
                    aria-pressed={sells}
                  >
                    <div className="role-card-title">I have surplus material</div>
                    <div className="role-card-desc">
                      List offcuts, scrap and by-products for nearby buyers.
                    </div>
                    <div className="role-card-tag">SELL</div>
                  </button>
                  <button
                    type="button"
                    className={buys ? "role-card is-selected" : "role-card"}
                    onClick={() => setBuys((v) => !v)}
                    aria-pressed={buys}
                  >
                    <div className="role-card-title">I buy materials</div>
                    <div className="role-card-desc">
                      Source recovered inputs from nearby manufacturers.
                    </div>
                    <div className="role-card-tag">BUY</div>
                  </button>
                </div>
                {!sells && !buys ? (
                  <div className="field-foot" style={{ color: "oklch(0.52 0.13 30)" }}>
                    Select at least one option
                  </div>
                ) : null}
              </div>

              <div>
                <label className="field-label">Business name</label>
                <input
                  value={business}
                  onChange={(e) => setBusiness(e.target.value)}
                  placeholder="e.g. Rehoboth Metalworks Ltd"
                  className="input"
                  required
                />
              </div>
            </>
          ) : null}

          <div>
            <label className="field-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.ng"
              className="input"
              autoComplete="email"
              required
            />
          </div>

          {!isForgot ? (
            <div>
              <div className="field-label-row">
                <label className="field-label">Password</label>
                {isLogin ? (
                  <button
                    type="button"
                    className="auth-forgot-link"
                    onClick={() => {
                      setError(null);
                      setInfo(null);
                      onModeChange("forgot");
                    }}
                  >
                    Forgot password?
                  </button>
                ) : null}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isLogin ? "Enter your password" : "At least 8 characters"}
                className="input"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                minLength={8}
              />
            </div>
          ) : null}

          {isSignup ? (
            <>
              <div className="form-row-2">
                <div>
                  <label className="field-label">Industrial cluster</label>
                  <Select
                    value={cluster}
                    options={["Ogba", "Ikeja", "Isolo", "Apapa"]}
                    onChange={setCluster}
                    aria-label="Industrial cluster"
                  />
                </div>
                <div>
                  <label className="field-label">Phone number</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 800 000 0000"
                    className="input input--mono"
                    required
                  />
                </div>
              </div>
              <label className="check-label check-label--block">
                <input
                  type="checkbox"
                  checked={carbonImpact}
                  onChange={(e) => setCarbonImpact(e.target.checked)}
                />
                Show me the Carbon impact page — track CO₂e diverted from my exchanges (optional)
              </label>
              <label className="check-label check-label--block">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                />
                I consent to anonymised platform activity being used in this research pilot
                (withdraw any time)
              </label>
            </>
          ) : null}
        </div>
      </div>

      <div className="auth-form-footer">
        {error ? (
          <div className="field-foot" style={{ color: "oklch(0.52 0.13 30)" }}>
            {error}
          </div>
        ) : null}
        {info ? (
          <div className="field-foot" style={{ color: "oklch(0.45 0.08 155)" }}>
            {info}
          </div>
        ) : null}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
          {submitting
            ? "Working…"
            : isForgot
              ? "Send reset link"
              : isLogin
                ? "Log in"
                : "Create account"}
        </button>
        <div className="onboard-login">
          {isForgot ? (
            <>
              Remembered it?{" "}
              <button
                type="button"
                className="auth-switch"
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  onModeChange("login");
                }}
              >
                Back to log in
              </button>
            </>
          ) : isLogin ? (
            <>
              New to EcoLoop?{" "}
              <button type="button" className="auth-switch" onClick={() => onModeChange("signup")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already registered?{" "}
              <button type="button" className="auth-switch" onClick={() => onModeChange("login")}>
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
