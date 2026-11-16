"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, isPublicPath } from "@/lib/auth-context";
import { NAV_LINKS } from "@/lib/navigation";

export function AppNav() {
  const pathname = usePathname();
  const { isAuthenticated, openAuth } = useAuth();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="app-nav" aria-label="Primary">
      {NAV_LINKS.map((link) => {
        const active = isActive(link.href);
        const locked = !isAuthenticated && !isPublicPath(link.href);

        if (locked) {
          return (
            <button
              key={link.href}
              type="button"
              className={active ? "app-nav-link is-active" : "app-nav-link"}
              onClick={() => openAuth("login", link.href)}
            >
              {link.label}
              {active ? <span className="app-nav-underline" aria-hidden /> : null}
            </button>
          );
        }

        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? "app-nav-link is-active" : "app-nav-link"}
          >
            {link.label}
            {active ? <span className="app-nav-underline" aria-hidden /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
