"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthModal } from "@/components/auth/AuthModal";
import { isPublicPath, useAuth } from "@/lib/auth-context";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, ready, openAuth, pendingPath, prefs } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (isAuthenticated) return;
    if (isPublicPath(pathname)) return;

    openAuth("login", pathname);
    router.replace("/");
  }, [pathname, isAuthenticated, ready, openAuth, router]);

  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    if (pathname.startsWith("/impact") && !prefs.carbonImpact) {
      router.replace("/dashboard");
    }
  }, [pathname, isAuthenticated, ready, prefs.carbonImpact, router]);

  useEffect(() => {
    function onSuccess(e: Event) {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      let path = detail?.path || pendingPath || "/dashboard";
      if (path.startsWith("/impact") && !prefs.carbonImpact) {
        // prefs may not have flushed yet for signup; AuthModal already adjusts path
        path = "/dashboard";
      }
      router.push(path);
    }
    window.addEventListener("ecoloop-auth-success", onSuccess);
    return () => window.removeEventListener("ecoloop-auth-success", onSuccess);
  }, [router, pendingPath, prefs.carbonImpact]);

  return (
    <>
      {children}
      <AuthModal />
    </>
  );
}
