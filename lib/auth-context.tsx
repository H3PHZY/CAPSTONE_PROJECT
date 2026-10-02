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
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { ProfileRow } from "@/lib/database.types";

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

interface AuthContextValue {
  isAuthenticated: boolean;
  ready: boolean;
  prefs: AuthPrefs;
  user: User | null;
  profile: ProfileRow | null;
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

const DEFAULT_PREFS: AuthPrefs = { carbonImpact: false };

function resetRedirectUrl() {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}/reset-password`;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [prefs, setPrefs] = useState<AuthPrefs>(DEFAULT_PREFS);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile(userId: string) {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (!active) return;
      setProfile(data);
      setPrefs({ carbonImpact: Boolean(data?.carbon_impact) });
    }

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (session?.user) void loadProfile(session.user.id);
      else setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (session?.user) void loadProfile(session.user.id);
      else {
        setProfile(null);
        setPrefs(DEFAULT_PREFS);
      }
      setReady(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
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
    const result = signup
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              business_name: signup.businessName,
              cluster: signup.cluster,
              phone: signup.phone,
              sells: signup.sells,
              buys: signup.buys,
              carbon_impact: signup.carbonImpact,
              research_consent: signup.researchConsent,
            },
          },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) throw result.error;
    if (!result.data.user) throw new Error("Supabase did not return a user");

    if (signup && !result.data.session) {
      throw new Error("Check your email to confirm your account, then log in.");
    }

    if (signup) {
      const { data, error } = await supabase
        .from("profiles")
        .upsert({
          id: result.data.user.id,
          business_name: signup.businessName,
          cluster: signup.cluster,
          phone: signup.phone,
          sells: signup.sells,
          buys: signup.buys,
          carbon_impact: signup.carbonImpact,
          research_consent: signup.researchConsent,
          // Pilot trust: complete seller/buyer profile → verified badge on listings
          verified: isPilotVerified({
            businessName: signup.businessName,
            phone: signup.phone,
            sells: signup.sells,
            buys: signup.buys,
          }),
        })
        .select()
        .single();
      if (error) throw error;
      setProfile(data);
      setPrefs({ carbonImpact: data.carbon_impact });
    }
    setAuthOpen(false);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: resetRedirectUrl(),
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
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
      const {
        data: { user: current },
      } = await supabase.auth.getUser();
      if (!current) throw new Error("You must be signed in to update your profile");
      if (!patch.sells && !patch.buys) {
        throw new Error("Select at least one of sell or buy");
      }
      const businessName = patch.businessName.trim();
      const phone = patch.phone.trim();
      const { data, error } = await supabase
        .from("profiles")
        .update({
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
        })
        .eq("id", current.id)
        .select()
        .single();
      if (error) throw error;
      setProfile(data);
      setPrefs({ carbonImpact: Boolean(data.carbon_impact) });
    },
    []
  );

  const updateAvatar = useCallback(async (avatarUrl: string | null) => {
    const {
      data: { user: current },
    } = await supabase.auth.getUser();
    if (!current) throw new Error("You must be signed in to update your photo");

    const { data, error } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", current.id)
      .select()
      .single();

    if (error) {
      if (/avatar_url|column/i.test(error.message)) {
        throw new Error(
          "Run supabase/migrations/013_profile_avatars.sql in the Supabase SQL Editor, then try again."
        );
      }
      throw error;
    }
    setProfile(data);
  }, []);

  const updateEmail = useCallback(async (email: string) => {
    const next = email.trim();
    if (!next) throw new Error("Email is required");
    const { data, error } = await supabase.auth.updateUser({ email: next });
    if (error) throw error;
    if (data.user) setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
