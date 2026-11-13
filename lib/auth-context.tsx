"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearTokens,
  DjangoApiError,
  getToken,
  SESSION_EXPIRED_EVENT,
  setTokens,
} from "@/lib/django-auth";
import { djangoRequest } from "@/lib/django-api";

// ─── Exported types ───────────────────────────────────────────────────────────

export type AuthMode = "login" | "signup" | "forgot";

export type AuthPrefs = {
  carbonImpact: boolean;
};

export type SignupProfile = {
  businessName: string;
  dateOfBirth: string;
  cluster: string;
  phone: string;
  sells: boolean;
  buys: boolean;
  carbonImpact: boolean;
  researchConsent: boolean;
};

export interface DjangoUser {
  id: string;
  email: string;
}

export interface DjangoProfile {
  id: string;
  email: string;
  business_name: string;
  phone: string | null;
  cluster: string;
  zone: string | null;
  address: string;
  date_of_birth: string | null;
  sells: boolean;
  buys: boolean;
  carbon_impact: boolean;
  research_consent: boolean;
  verified: boolean;
  avatar_url: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

type DjangoProfileResponse = Omit<DjangoProfile, "id" | "email"> & {
  display_avatar_url?: string | null;
};

type DjangoUserResponse = {
  id: string;
  email: string;
  profile: DjangoProfileResponse;
};

type DjangoAuthResponse = {
  user: DjangoUserResponse;
  tokens: { access: string; refresh: string };
};

type DjangoCredentialResponse = DjangoUserResponse & {
  tokens?: { access: string; refresh: string };
};

/** Pilot trust model: business name + phone + sell/buy role → verified badge. */
export function isPilotVerified(input: {
  businessName: string;
  phone: string | null | undefined;
  sells: boolean;
  buys: boolean;
}): boolean {
  const name = input.businessName.trim();
  const phone = (input.phone ?? "").trim();
  return Boolean(name && phone && (input.sells || input.buys));
}

// ─── Auth context ────────────────────────────────────────────────────────────

export interface AuthContextValue {
  isAuthenticated: boolean;
  ready: boolean;
  prefs: AuthPrefs;
  user: DjangoUser | null;
  profile: DjangoProfile | null;
  authOpen: boolean;
  authMode: AuthMode;
  pendingPath: string | null;
  openAuth: (mode?: AuthMode, pendingPath?: string | null) => void;
  closeAuth: () => void;
  setAuthMode: (mode: AuthMode) => void;
  login: (email: string, password: string, signup?: SignupProfile) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string, currentPassword: string) => Promise<void>;
  updateProfile: (patch: {
    businessName: string;
    phone: string;
    cluster: string;
    sells: boolean;
    buys: boolean;
    carbonImpact: boolean;
    zone?: string | null;
    address?: string;
    lat?: number | null;
    lng?: number | null;
  }) => Promise<void>;
  updateAvatar: (avatarUrl: string | null) => Promise<void>;
  updateEmail: (email: string, currentPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: AuthPrefs = { carbonImpact: false };

const AuthContext = createContext<AuthContextValue | null>(null);

function profileFromResponse(user: DjangoUserResponse): DjangoProfile {
  return {
    ...user.profile,
    id: user.id,
    email: user.email,
    avatar_url: user.profile.display_avatar_url ?? user.profile.avatar_url,
  };
}

/** Fetch the current user+profile from Django. An expired token is an anonymous session. */
async function fetchMe(): Promise<DjangoProfile | null> {
  if (!getToken()) return null;
  try {
    const user = await djangoRequest<DjangoUserResponse>("/auth/me/");
    return profileFromResponse(user);
  } catch (error) {
    if (error instanceof DjangoApiError && error.status === 401) return null;
    throw error;
  }
}

function profileToUser(p: DjangoProfile): DjangoUser {
  return { id: p.id, email: p.email };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<DjangoUser | null>(null);
  const [profile, setProfile] = useState<DjangoProfile | null>(null);
  const [prefs, setPrefs] = useState<AuthPrefs>(DEFAULT_PREFS);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  // On mount: restore session from localStorage token → GET /api/auth/me/
  useEffect(() => {
    let active = true;
    void fetchMe().then((p) => {
      if (!active) return;
      if (p) {
        setUser(profileToUser(p));
        setProfile(p);
        setPrefs({ carbonImpact: Boolean(p.carbon_impact) });
      }
      setReady(true);
    }).catch((error: unknown) => {
      console.error("Could not restore the Django session", error);
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => {
      setUser(null);
      setProfile(null);
      setPrefs(DEFAULT_PREFS);
      setPendingPath(null);
      setAuthOpen(false);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () =>
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
  }, []);

  const isAuthenticated = Boolean(user);

  const openAuth = useCallback((mode: AuthMode = "login", nextPath: string | null = null) => {
    setAuthMode(mode);
    setPendingPath(nextPath);
    setAuthOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    setPendingPath(null);
  }, []);

  const login = useCallback(async (email: string, password: string, signup?: SignupProfile) => {
    let res: DjangoAuthResponse;
    if (signup) {
      res = await djangoRequest<DjangoAuthResponse>("/auth/signup/", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          business_name: signup.businessName,
          date_of_birth: signup.dateOfBirth,
          cluster: signup.cluster,
          phone: signup.phone,
          sells: signup.sells,
          buys: signup.buys,
          carbon_impact: signup.carbonImpact,
          research_consent: signup.researchConsent,
        }),
      });
    } else {
      res = await djangoRequest<DjangoAuthResponse>("/auth/login/", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    }

    setTokens(res.tokens.access, res.tokens.refresh);
    const profileData = profileFromResponse(res.user);
    setUser(profileToUser(profileData));
    setProfile(profileData);
    setPrefs({ carbonImpact: Boolean(profileData.carbon_impact) });
    setAuthOpen(false);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await djangoRequest<{ detail: string }>("/auth/password-reset/", {
      method: "POST",
      body: JSON.stringify({ email: email.trim() }),
    });
  }, []);

  const updatePassword = useCallback(async (password: string, currentPassword: string) => {
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    const response = await djangoRequest<DjangoCredentialResponse>("/auth/me/", {
      method: "PATCH",
      body: JSON.stringify({ password, current_password: currentPassword }),
    });
    if (response.tokens) setTokens(response.tokens.access, response.tokens.refresh);
    const data = profileFromResponse(response);
    setProfile(data);
    setUser(profileToUser(data));
  }, []);

  const updateProfile = useCallback(
    async (patch: {
      businessName: string;
      phone: string;
      cluster: string;
      sells: boolean;
      buys: boolean;
      carbonImpact: boolean;
      zone?: string | null;
      address?: string;
      lat?: number | null;
      lng?: number | null;
    }) => {
      if (!patch.sells && !patch.buys) {
        throw new Error("Select at least one of sell or buy");
      }
      const businessName = patch.businessName.trim();
      const phone = patch.phone.trim();

      const data = profileFromResponse(
        await djangoRequest<DjangoUserResponse>("/auth/me/", {
          method: "PATCH",
          body: JSON.stringify({
        business_name: businessName,
        phone: phone || null,
        cluster: patch.cluster,
        sells: patch.sells,
        buys: patch.buys,
        carbon_impact: patch.carbonImpact,
        ...(patch.zone !== undefined ? { zone: patch.zone } : {}),
        ...(patch.address !== undefined ? { address: patch.address } : {}),
        ...(patch.lat !== undefined ? { lat: patch.lat } : {}),
        ...(patch.lng !== undefined ? { lng: patch.lng } : {}),
        verified: isPilotVerified({
          businessName,
          phone,
          sells: patch.sells,
          buys: patch.buys,
        }),
          }),
        })
      );
      setProfile(data);
      setPrefs({ carbonImpact: Boolean(data.carbon_impact) });
    },
    []
  );

  const updateAvatar = useCallback(async (avatarUrl: string | null) => {
    const response = await djangoRequest<DjangoUserResponse>("/auth/me/", {
      method: "PATCH",
      body: JSON.stringify({ avatar_url: avatarUrl }),
    });
    const data = profileFromResponse(response);
    setProfile(data);
  }, []);

  const updateEmail = useCallback(async (email: string, currentPassword: string) => {
    const next = email.trim();
    if (!next) throw new Error("Email is required");
    const response = await djangoRequest<DjangoCredentialResponse>("/auth/me/", {
      method: "PATCH",
      body: JSON.stringify({ email: next, current_password: currentPassword }),
    });
    if (response.tokens) setTokens(response.tokens.access, response.tokens.refresh);
    const data = profileFromResponse(response);
    setProfile(data);
    setUser(profileToUser(data));
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getToken()) {
        await djangoRequest<void>("/auth/logout/", { method: "POST" });
      }
    } catch (error) {
      console.warn("Could not revoke the server session during logout", error);
    } finally {
      clearTokens();
      setUser(null);
      setProfile(null);
      setPrefs(DEFAULT_PREFS);
      setPendingPath(null);
      setAuthOpen(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      ready,
      prefs,
      user,
      profile,
      authOpen,
      authMode,
      pendingPath,
      openAuth,
      closeAuth,
      setAuthMode,
      login,
      requestPasswordReset,
      updatePassword,
      updateProfile,
      updateAvatar,
      updateEmail,
      logout,
    }),
    [
      isAuthenticated,
      ready,
      prefs,
      user,
      profile,
      authOpen,
      authMode,
      pendingPath,
      openAuth,
      closeAuth,
      login,
      requestPasswordReset,
      updatePassword,
      updateProfile,
      updateAvatar,
      updateEmail,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export function isPublicPath(pathname: string) {
  return pathname === "/" || pathname === "/reset-password";
}
