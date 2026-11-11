"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { djangoRequest } from "@/lib/django-api";

export function ResetPasswordPage() {
  const router = useRouter();
  const { openAuth, ready } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetToken, setResetToken] = useState<{ uid: string; token: string } | null>(
    null
  );
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");
    const token = params.get("token");
    if (uid && token) setResetToken({ uid, token });
    setChecking(false);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!resetToken) {
      setError("This password reset link is invalid or has expired.");
      return;
    }

    setSubmitting(true);
    try {
      await djangoRequest<{ detail: string }>("/auth/password-reset/confirm/", {
        method: "POST",
        body: JSON.stringify({ ...resetToken, password }),
      });
      setDone(true);
      setTimeout(() => router.push("/login"), 1200);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update password");
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

  if (!resetToken && !done) {
    return (
      <div className="page-shell">
        <div className="panel panel--pad" style={{ maxWidth: 460, margin: "48px auto" }}>
          <div className="panel-label">RESET PASSWORD</div>
          <h1 className="page-title" style={{ fontSize: 28 }}>
            Link missing or expired
          </h1>
          <p className="auth-lede">
            Open the reset link from your email, or request a new one.
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
          <p className="auth-lede">Password updated. Redirecting you to sign in…</p>
        ) : (
          <form className="form-stack" onSubmit={(event) => void submit(event)} style={{ marginTop: 18 }}>
            <div>
              <label className="field-label">New password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
                onChange={(event) => setConfirm(event.target.value)}
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
