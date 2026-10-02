"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

export function ResetPasswordPage() {
  const router = useRouter();
  const { updatePassword, openAuth, ready } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session) setRecoveryReady(true);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setRecoveryReady(true);
        setChecking(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || checking) {
    return (
      <div className="page-shell">
        <div className="page-sub">Checking reset link…</div>
      </div>
    );
  }

  if (!recoveryReady && !done) {
    return (
      <div className="page-shell">
        <div className="panel panel--pad" style={{ maxWidth: 460, margin: "48px auto" }}>
          <div className="panel-label">RESET PASSWORD</div>
          <h1 className="page-title" style={{ fontSize: 28 }}>
            Link missing or expired
          </h1>
          <p className="auth-lede">
            Open the reset link from your email on this device, or request a new one.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openAuth("forgot")}
          >
            Request a new link
          </button>
          <div className="field-foot" style={{ marginTop: 14 }}>
            <Link href="/">Back to home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="panel panel--pad" style={{ maxWidth: 460, margin: "48px auto" }}>
        <div className="panel-label">RESET PASSWORD</div>
        <h1 className="page-title" style={{ fontSize: 28 }}>
          {done ? "Password updated" : "Choose a new password"}
        </h1>
        {done ? (
          <p className="auth-lede">You’re signed in. Redirecting to your dashboard…</p>
        ) : (
          <form className="form-stack" onSubmit={submit} style={{ marginTop: 18 }}>
            <div>
              <label className="field-label">New password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="field-label">Confirm password</label>
              <input
                type="password"
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                placeholder="Repeat password"
              />
            </div>
            {error ? (
              <div className="field-foot" style={{ color: "oklch(0.52 0.13 30)" }}>
                {error}
              </div>
            ) : null}
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
              {submitting ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
