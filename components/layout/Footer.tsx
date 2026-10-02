"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function Footer() {
  const { openAuth } = useAuth();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-grid">
          <div>
            <div className="site-footer-brand">
              <span className="app-brand-mark app-brand-mark--sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/ecoloop-mark.png" alt="" />
              </span>
              <span className="app-brand-wordmark app-brand-wordmark--sm">ECOLOOP</span>
            </div>
            <p className="site-footer-tagline">
              An industrial waste redistribution marketplace for SME manufacturers in Lagos State.
            </p>
          </div>

          <div>
            <div className="site-footer-col-label">PLATFORM</div>
            <div className="site-footer-links">
              <Link href="/marketplace">Marketplace</Link>
              <Link href="/listings/new">List a material</Link>
              <Link href="/impact">Carbon methodology</Link>
            </div>
          </div>

          <div>
            <div className="site-footer-col-label">PILOT</div>
            <div className="site-footer-links">
              <button type="button" className="site-footer-link-btn" onClick={() => openAuth("signup")}>
                Join the pilot
              </button>
              <Link href="/marketplace">For buyers &amp; recyclers</Link>
              <a href="mailto:research@ecoloop.ng">Contact the research team</a>
            </div>
          </div>

          <div className="site-footer-notice">
            <div className="site-footer-notice-label">RESEARCH NOTICE</div>
            <p>
              EcoLoop is operating as an academic pilot. Platform activity is analysed in
              anonymised form (SME-01, SME-02…) with written consent, and can be withdrawn at any
              time. Carbon figures are LCA-based estimates, not certified offsets.
            </p>
          </div>
        </div>

        <div className="site-footer-bottom">
          <span>© 2026 EcoLoop · BSE Capstone, African Leadership University</span>
          <span>Lagos, Nigeria</span>
        </div>
      </div>
    </footer>
  );
}
