"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/lib/auth-context";

import type { SignupProfile } from "@/lib/auth-context";

export function AuthModal() {
  const {
    authOpen,
    authMode,
    setAuthMode,
    closeAuth,
    login,
    requestPasswordReset,
    pendingPath,
  } = useAuth();

  useEffect(() => {
    if (!authOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeAuth();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [authOpen, closeAuth]);

  if (!authOpen || typeof document === "undefined") return null;

  async function handleSuccess(email: string, password: string, signup?: SignupProfile) {
    let next = pendingPath && pendingPath !== "/" ? pendingPath : "/dashboard";
    await login(email, password, signup);
    if (next.startsWith("/impact")) {
      const enabled =
        signup && Object.prototype.hasOwnProperty.call(signup, "carbonImpact")
          ? Boolean(signup.carbonImpact)
          : undefined;
      if (enabled === false) next = "/dashboard";
    }
    window.dispatchEvent(new CustomEvent("ecoloop-auth-success", { detail: { path: next } }));
  }

  const title =
    authMode === "forgot"
      ? "RESET PASSWORD"
      : authMode === "login"
        ? "WELCOME BACK"
        : "JOIN THE PILOT";
  const kicker =
    authMode === "forgot"
      ? "Forgot your password?"
      : authMode === "login"
        ? "Log in to EcoLoop"
        : "Create your account";

  return createPortal(
    <div className="auth-modal-root" role="presentation">
      <button
        type="button"
        className="auth-modal-backdrop"
        aria-label="Close"
        onClick={closeAuth}
      />
      <div
        className={`auth-modal ${authMode === "signup" ? "auth-modal--signup" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="auth-modal-head">
          <div>
            <div className="panel-label" id="auth-modal-title">
              {title}
            </div>
            <div className="auth-modal-kicker">{kicker}</div>
          </div>
          <button type="button" className="auth-modal-close" onClick={closeAuth} aria-label="Close">
            ×
          </button>
        </div>
        <AuthForm
          mode={authMode}
          onModeChange={setAuthMode}
          onSuccess={handleSuccess}
          onForgotSubmit={requestPasswordReset}
        />
      </div>
    </div>,
    document.body
  );
}
