"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { useAuth } from "@/lib/auth-context";

export function AppHeader() {
  const { isAuthenticated, openAuth, logout, profile } = useAuth();
  const router = useRouter();

  function handleLogout() {
    void logout()
      .then(() => router.push("/"))
      .catch(() => undefined);
  }

  return (
    <header className="app-header">
      <div className="app-header-left">
        <Link href="/" className="app-brand">
          <span className="app-brand-mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/ecoloop-mark.png" alt="EcoLoop" />
          </span>
          <span className="app-brand-wordmark">ECOLOOP</span>
        </Link>
      </div>

      <div className="app-header-right">
        {isAuthenticated ? (
          <>
            <Link href="/profile" className="app-user app-user--link" title="Open profile">
              <ProfileAvatar
                name={profile?.business_name || "EcoLoop"}
                url={profile?.avatar_url}
                size="sm"
                className="app-user-avatar"
              />
              <div className="app-user-meta">
                <div className="app-user-name">{profile?.business_name || "EcoLoop member"}</div>
                <div className="app-user-role">{profile?.cluster || "Lagos"} · Profile</div>
              </div>
            </Link>

            <button
              type="button"
              className="btn btn-ghost-light btn-sm header-logout"
              onClick={handleLogout}
            >
              Log out
            </button>
          </>
        ) : (
          <div className="header-auth-actions">
            <button
              type="button"
              className="btn btn-ghost-light btn-sm"
              onClick={() => openAuth("login")}
            >
              Log in
            </button>
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={() => openAuth("signup")}
            >
              Sign up
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
