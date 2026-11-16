"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthModal } from "@/components/auth/AuthModal";
import { isPublicPath, useAuth } from "@/lib/auth-context";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, ready, openAuth, pendingPath } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (isAuthenticated) return;
    if (isPublicPath(pathname)) return;

    openAuth("login", pathname);
    router.replace("/");
  }, [pathname, isAuthenticated, ready, openAuth, router]);

  useEffect(() => {
    function onSuccess(e: Event) {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      const path = detail?.path || pendingPath || "/dashboard";
      router.push(path);
    }
    window.addEventListener("ecoloop-auth-success", onSuccess);
    return () => window.removeEventListener("ecoloop-auth-success", onSuccess);
  }, [router, pendingPath]);

  return (
    <>
      {children}
      <AuthModal />
    </>
  );
}
