"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { useAuth } from "@/lib/auth-context";
import { uploadProfileAvatar, validateProfileAvatar } from "@/lib/profile-avatars";

export function ProfilePage() {
  const router = useRouter();
  const {
    ready,
    user,
    profile,
    openAuth,
    updateProfile,
    updateAvatar,
    updateEmail,
    updatePassword,
    logout,
  } = useAuth();

  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [cluster, setCluster] = useState("Ogba");
  const [sells, setSells] = useState(true);
  const [buys, setBuys] = useState(true);
  const [carbonImpact, setCarbonImpact] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);
  const [avatarErr, setAvatarErr] = useState<string | null>(null);
  const [impactMsg, setImpactMsg] = useState<string | null>(null);
  const [impactErr, setImpactErr] = useState<string | null>(null);
  const [credMsg, setCredMsg] = useState<string | null>(null);
  const [credErr, setCredErr] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingImpact, setSavingImpact] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      openAuth("login", "/profile");
      router.replace("/");
    }
  }, [ready, user, openAuth, router]);

  useEffect(() => {
    if (!profile) return;
    setBusinessName(profile.business_name || "");
    setPhone(profile.phone || "");
    setCluster(profile.cluster || "Ogba");
    setSells(profile.sells);
    setBuys(profile.buys);
    setCarbonImpact(profile.carbon_impact);
  }, [profile]);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  if (!ready || !user) {
    return (
      <div className="page-shell">
        <div className="page-sub">Loading profile…</div>
      </div>
    );
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);
    setSavingProfile(true);
    try {
      await updateProfile({
        businessName,
        phone,
        cluster,
        sells,
        buys,
        carbonImpact,
      });
      const nowVerified = Boolean(
        businessName.trim() && phone.trim() && (sells || buys)
      );
      setProfileMsg(
        nowVerified
          ? "Profile saved. Your listings now show as Verified."
          : "Profile saved. Add a phone number to get the Verified badge."
      );
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveImpactPreference(e: React.FormEvent) {
    e.preventDefault();
    setImpactMsg(null);
    setImpactErr(null);
    setSavingImpact(true);
    try {
      await updateProfile({
        businessName: businessName || profile?.business_name || "EcoLoop member",
        phone,
        cluster,
        sells,
        buys,
        carbonImpact,
      });
      setImpactMsg(
        carbonImpact
          ? "Carbon impact is on — you’ll see it in the navigation."
          : "Carbon impact is off — the page is hidden from your navigation."
      );
    } catch (err) {
      setImpactErr(err instanceof Error ? err.message : "Could not save preference");
    } finally {
      setSavingImpact(false);
    }
  }

  async function saveCredentials(e: React.FormEvent) {
    e.preventDefault();
    setCredMsg(null);
    setCredErr(null);
    setSavingCreds(true);
    try {
      const notes: string[] = [];
      if (email.trim() && email.trim() !== (user?.email || "")) {
        await updateEmail(email);
        notes.push("Check your inbox to confirm the new email.");
      }
      if (password) {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        await updatePassword(password);
        setPassword("");
        setConfirmPassword("");
        notes.push("Password updated.");
      }
      if (notes.length === 0) {
        setCredMsg("No credential changes to save.");
      } else {
        setCredMsg(notes.join(" "));
      }
    } catch (err) {
      setCredErr(err instanceof Error ? err.message : "Could not update credentials");
    } finally {
      setSavingCreds(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const invalid = validateProfileAvatar(file);
    if (invalid) {
      setAvatarErr(invalid);
      return;
    }
    setAvatarErr(null);
    setAvatarMsg(null);
    setSavingAvatar(true);
    try {
      const uploaded = await uploadProfileAvatar(user.id, file);
      await updateAvatar(uploaded.publicUrl);
      setAvatarMsg("Profile photo updated.");
    } catch (err) {
      setAvatarErr(err instanceof Error ? err.message : "Could not upload photo");
    } finally {
      setSavingAvatar(false);
    }
  }

  async function onRemoveAvatar() {
    if (!profile?.avatar_url) return;
    setAvatarErr(null);
    setAvatarMsg(null);
    setSavingAvatar(true);
    try {
      await updateAvatar(null);
      setAvatarMsg("Profile photo removed.");
    } catch (err) {
      setAvatarErr(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setSavingAvatar(false);
    }
  }

  return (
    <div className="page-shell page-shell--wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Your profile</h1>
          <div className="page-sub">Update business details, impact preferences, and credentials</div>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => void handleLogout()}>
          Log out
        </button>
      </div>

      <div className="profile-hero">
        <ProfileAvatar
          name={businessName || "EcoLoop member"}
          url={profile?.avatar_url}
          size="lg"
          className="profile-hero-avatar-wrap"
        />
        <div className="profile-hero-main">
          <div className="profile-hero-name">{businessName || "EcoLoop member"}</div>
          <div className="profile-hero-meta">
            {user.email || "No email"} · {cluster}
            {profile?.verified ? " · Verified seller" : " · Not verified yet"}
            {carbonImpact ? " · Carbon impact on" : ""}
          </div>
          <div className="profile-avatar-actions">
            <input
              ref={avatarRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              onChange={(e) => void onPickAvatar(e)}
            />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={savingAvatar}
              onClick={() => avatarRef.current?.click()}
            >
              {savingAvatar ? "Uploading…" : profile?.avatar_url ? "Change photo" : "Add company photo"}
            </button>
            {profile?.avatar_url ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={savingAvatar}
                onClick={() => void onRemoveAvatar()}
              >
                Remove
              </button>
            ) : null}
          </div>
          {avatarErr ? (
            <div className="field-foot" style={{ marginTop: 8, color: "oklch(0.52 0.13 30)" }}>
              {avatarErr}
            </div>
          ) : null}
          {avatarMsg ? (
            <div className="field-foot" style={{ marginTop: 8, color: "oklch(0.45 0.08 155)" }}>
              {avatarMsg}
            </div>
          ) : null}
          {!profile?.verified ? (
            <div className="field-foot" style={{ marginTop: 8 }}>
              Add a business name and phone, then save — your listings will show the Verified badge
              (pilot trust).
            </div>
          ) : null}
        </div>
      </div>

      <div className="profile-grid">
        <form className="panel panel--pad" onSubmit={saveProfile}>
          <div className="panel-label">BUSINESS PROFILE</div>
          <div className="form-stack" style={{ marginTop: 14 }}>
            <div>
              <div className="field-label">What do you use EcoLoop for?</div>
              <div className="role-cards role-cards--compact">
                <button
                  type="button"
                  className={sells ? "role-card is-selected" : "role-card"}
                  onClick={() => setSells((v) => !v)}
                  aria-pressed={sells}
                >
                  <div className="role-card-title">I have surplus material</div>
                  <div className="role-card-tag">SELL</div>
                </button>
                <button
                  type="button"
                  className={buys ? "role-card is-selected" : "role-card"}
                  onClick={() => setBuys((v) => !v)}
                  aria-pressed={buys}
                >
                  <div className="role-card-title">I buy materials</div>
                  <div className="role-card-tag">BUY</div>
                </button>
              </div>
            </div>

            <div>
              <label className="field-label">Business name</label>
              <input
                className="input"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
            </div>

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
                  className="input input--mono"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  required
                />
                <div className="field-foot">Required for the marketplace Verified badge.</div>
              </div>
            </div>

            {profileErr ? (
              <div className="field-foot" style={{ color: "oklch(0.52 0.13 30)" }}>
                {profileErr}
              </div>
            ) : null}
            {profileMsg ? (
              <div className="field-foot" style={{ color: "oklch(0.45 0.08 155)" }}>
                {profileMsg}
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>

        <form className="panel panel--pad" onSubmit={saveCredentials}>
          <div className="panel-label">ACCOUNT CREDENTIALS</div>
          <div className="form-stack" style={{ marginTop: 14 }}>
            <div>
              <label className="field-label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <div className="field-foot">
                Changing email may require confirmation from the new address.
              </div>
            </div>

            <div>
              <label className="field-label">New password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                placeholder="Leave blank to keep current password"
              />
            </div>

            <div>
              <label className="field-label">Confirm new password</label>
              <input
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                placeholder="Repeat new password"
              />
            </div>

            {credErr ? (
              <div className="field-foot" style={{ color: "oklch(0.52 0.13 30)" }}>
                {credErr}
              </div>
            ) : null}
            {credMsg ? (
              <div className="field-foot" style={{ color: "oklch(0.45 0.08 155)" }}>
                {credMsg}
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary" disabled={savingCreds}>
              {savingCreds ? "Saving…" : "Update credentials"}
            </button>
          </div>
        </form>
      </div>

      <form className="profile-impact-optin" onSubmit={saveImpactPreference}>
        <div className="profile-impact-optin-copy">
          <div className="panel-label">OPTIONAL · CARBON IMPACT</div>
          <h2 className="profile-impact-optin-title">Track CO₂e from your exchanges</h2>
          <p className="profile-impact-optin-lede">
            Opt in to unlock a private Carbon impact page. EcoLoop estimates how much CO₂e each
            completed exchange keeps out of landfill using LCA reference factors. Figures are
            estimates for feedback — not certified carbon offsets.
          </p>
          <ul className="profile-impact-optin-points">
            <li>See diverted tonnes and CO₂e for your completed deals</li>
            <li>Carbon impact appears in your navigation when enabled</li>
            <li>You can turn this off any time — marketplace and messaging still work</li>
          </ul>
        </div>
        <div className="profile-impact-optin-aside">
          <label className="profile-impact-toggle">
            <input
              type="checkbox"
              checked={carbonImpact}
              onChange={(e) => setCarbonImpact(e.target.checked)}
            />
            <span>
              <strong>{carbonImpact ? "Opted in" : "Opt in"}</strong>
              <span className="profile-impact-toggle-sub">
                {carbonImpact
                  ? "Carbon impact page is available in nav"
                  : "Enable the Carbon impact page"}
              </span>
            </span>
          </label>
          {impactErr ? (
            <div className="field-foot" style={{ color: "oklch(0.52 0.13 30)" }}>
              {impactErr}
            </div>
          ) : null}
          {impactMsg ? (
            <div className="field-foot" style={{ color: "oklch(0.45 0.08 155)" }}>
              {impactMsg}
            </div>
          ) : null}
          <div className="profile-impact-optin-actions">
            <button type="submit" className="btn btn-primary" disabled={savingImpact}>
              {savingImpact ? "Saving…" : "Save preference"}
            </button>
            {carbonImpact ? (
              <Link href="/impact" className="btn btn-outline">
                Open Carbon impact
              </Link>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}
