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
import { apiFetch, setTokens, clearTokens } from "@/lib/django-auth";

// ─── Exported types ───────────────────────────────────────────────────────────

export type AuthMode = "login" | "signup" | "forgot";

export type AuthPrefs = {
  carbonImpact: boolean;
};

export type SignupProfile = {
  businessName: string;
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

// ─── Context type (same surface as the old Supabase version) ─────────────────

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
  updatePassword: (password: string) => Promise<void>;
  updateProfile: (patch: {
    businessName: string;
    phone: string;
    cluster: string;
    sells: boolean;
    buys: boolean;
    carbonImpact: boolean;
  }) => Promise<void>;
  updateAvatar: (avatarUrl: string | null) => Promise<void>;
  updateEmail: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: AuthPrefs = { carbonImpact: false };

const AuthContext = createContext<AuthContextValue | null>(null);

/** Fetch the current user+profile from Django. Returns null on 401 / network errors. */
async function fetchMe(): Promise<DjangoProfile | null> {
  try {
    const res = await apiFetch("/auth/me/");
    if (!res.ok) return null;
    return (await res.json()) as DjangoProfile;
  } catch {
    return null;
  }
}

/** Call Django REST and throw on error. */
async function djangoPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      (data as { detail?: string; error?: string }).detail ||
        (data as { detail?: string; error?: string }).error ||
        JSON.stringify(data)
    );
  }
  return data as T;
}

async function djangoPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      (data as { detail?: string; error?: string }).detail ||
        (data as { detail?: string; error?: string }).error ||
        JSON.stringify(data)
    );
  }
  return data as T;
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
    });
    return () => {
      active = false;
    };
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
    type AuthResponse = { user: DjangoProfile; tokens: { access: string; refresh: string } };

    let res: AuthResponse;
    if (signup) {
      res = await djangoPost<AuthResponse>("/auth/signup/", {
        email,
        password,
        business_name: signup.businessName,
        cluster: signup.cluster,
        phone: signup.phone,
        sells: signup.sells,
        buys: signup.buys,
        carbon_impact: signup.carbonImpact,
        research_consent: signup.researchConsent,
      });
    } else {
      res = await djangoPost<AuthResponse>("/auth/login/", { email, password });
    }

    setTokens(res.tokens.access, res.tokens.refresh);

    // Fetch the full profile after login (tokens are now in localStorage)
    const p = await fetchMe();
    if (p) {
      setUser(profileToUser(p));
      setProfile(p);
      setPrefs({ carbonImpact: Boolean(p.carbon_impact) });
    } else if (res.user) {
      // Fallback: use the user object returned by signup/login
      const u = res.user;
      setUser(profileToUser(u));
      setProfile(u);
      setPrefs({ carbonImpact: Boolean(u.carbon_impact) });
    }

    setAuthOpen(false);
  }, []);

  /** Not supported with Django JWT — use the Django admin panel or a dedicated reset flow. */
  const requestPasswordReset = useCallback(async (_email: string) => {
    throw new Error("Use the Django admin panel to reset passwords for now.");
  }, []);

  const updatePassword = useCallback(async (_password: string) => {
    throw new Error("Use the Django admin panel to reset passwords for now.");
  }, []);

  const updateProfile = useCallback(
    async (patch: {
      businessName: string;
      phone: string;
      cluster: string;
      sells: boolean;
      buys: boolean;
      carbonImpact: boolean;
    }) => {
      if (!patch.sells && !patch.buys) {
        throw new Error("Select at least one of sell or buy");
      }
      const businessName = patch.businessName.trim();
      const phone = patch.phone.trim();

      const data = await djangoPatch<DjangoProfile>("/auth/me/", {
        business_name: businessName,
        phone: phone || null,
        cluster: patch.cluster,
        sells: patch.sells,
        buys: patch.buys,
        carbon_impact: patch.carbonImpact,
        verified: isPilotVerified({
          businessName,
          phone,
          sells: patch.sells,
          buys: patch.buys,
        }),
      });
      setProfile(data);
      setPrefs({ carbonImpact: Boolean(data.carbon_impact) });
    },
    []
  );

  const updateAvatar = useCallback(async (avatarUrl: string | null) => {
    const data = await djangoPatch<DjangoProfile>("/auth/me/", { avatar_url: avatarUrl });
    setProfile(data);
  }, []);

  const updateEmail = useCallback(async (email: string) => {
    const next = email.trim();
    if (!next) throw new Error("Email is required");
    const data = await djangoPatch<DjangoProfile>("/auth/me/", { email: next });
    setProfile(data);
    setUser(profileToUser(data));
  }, []);

  const logout = useCallback(async () => {
    clearTokens();
    setUser(null);
    setProfile(null);
    setPrefs(DEFAULT_PREFS);
    setPendingPath(null);
    setAuthOpen(false);
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
