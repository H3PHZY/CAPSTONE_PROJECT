"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { useAuth } from "@/lib/auth-context";
import {
  CATS,
  FAQS,
  HERO_STATS,
  HOW_STEPS,
} from "@/lib/data";
import { fetchLiveListings } from "@/lib/listings";
import type { Listing } from "@/lib/types";

export function HomePage() {
  const [faqOpen, setFaqOpen] = useState(0);
  const [samples, setSamples] = useState<Listing[]>([]);
  const { openAuth } = useAuth();

  useEffect(() => {
    let active = true;
    void fetchLiveListings()
      .then((rows) => {
        if (active) setSamples(rows.slice(0, 3));
      })
      .catch(() => {
        if (active) setSamples([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <section className="home-hero">
        <div className="home-hero-grid">
          <div>
            <div className="home-pilot-pill">
              <span className="home-pilot-dot" />
              <span>PILOT LIVE · OGBA–IKEJA CLUSTER</span>
            </div>
            <h1 className="home-hero-title">Nothing leaves this cluster as waste.</h1>
            <p className="home-hero-lede">
              EcoLoop turns the offcuts, scrap and by-products of Lagos manufacturers into raw
              material for the factory down the road — photographed, classified by AI in seconds,
              and matched to verified buyers nearby. Every exchange shows the carbon it keeps out
              of landfill.
            </p>
            <div className="home-hero-ctas">
              <Link href="/listings/new" className="btn btn-accent btn-lg">
                I have surplus material
              </Link>
              <Link href="/marketplace" className="btn btn-ghost-light btn-lg">
                I&apos;m looking to buy
              </Link>
            </div>
            <div className="home-hero-note">
              Free to list during the pilot · agree payment in chat
            </div>
          </div>

          <div className="home-hero-stats">
            <div className="home-hero-stats-label">PILOT TO DATE</div>
            <div className="home-hero-stats-list">
              {HERO_STATS.map((h) => (
                <div key={h.k} className="home-hero-stat">
                  <div className="home-hero-stat-row">
                    <div className="home-hero-stat-v">{h.v}</div>
                    <div className="home-hero-stat-unit">{h.unit}</div>
                  </div>
                  <div className="home-hero-stat-k">{h.k}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="home-hero-rule" />
        <div className="home-streams">
          <span className="home-streams-label">MATERIAL STREAMS ACCEPTED</span>
          <div className="home-streams-chips">
            {CATS.map((c) => (
              <span key={c} className="home-stream-chip">
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="section-label">HOW IT WORKS</div>
        <h2 className="section-title">Three steps, under a minute.</h2>
        <div className="how-grid">
          {HOW_STEPS.map((h) => (
            <div key={h.n} className="how-card">
              <div className="how-num">{h.n}</div>
              <div className="how-title">{h.t}</div>
              <div className="how-desc">{h.d}</div>
              <div className="how-meta">{h.meta}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="carbon-explain">
        <div className="carbon-explain-inner">
          <div className="carbon-explain-copy">
            <div className="section-label">OPTIONAL · CARBON IMPACT</div>
            <h2 className="section-title">Know the climate value of every exchange.</h2>
            <p className="carbon-explain-lede">
              When you enable Carbon impact at sign up, EcoLoop adds a private page that estimates
              how much CO₂e each completed exchange keeps out of landfill — using LCA reference
              factors for metal, plastic, wood, glass, cardboard and biodegradable streams versus
              virgin material.
            </p>
            <ul className="carbon-explain-points">
              <li>See diverted tonnes and CO₂e for your own exchanges, month by month</li>
              <li>Share a simple impact summary with partners, auditors or your team</li>
              <li>
                Help the research pilot measure whether visible carbon feedback changes behaviour
              </li>
            </ul>
            <p className="carbon-explain-note">
              Figures are estimates for feedback, not certified carbon offsets. You can skip this
              at sign up — Carbon impact will not appear in your navigation unless you opt in.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openAuth("signup")}
            >
              Sign up and enable Carbon impact
            </button>
          </div>
          <div className="carbon-explain-preview" aria-hidden>
            <div className="carbon-explain-preview-label">IF YOU ENABLE IT</div>
            <div className="carbon-explain-preview-stat">
              <span className="carbon-explain-preview-v">18.4</span>
              <span className="carbon-explain-preview-u">tonnes CO₂e</span>
            </div>
            <div className="carbon-explain-preview-k">diverted from landfill in the pilot</div>
            <div className="carbon-explain-preview-bars">
              <div style={{ height: "42%" }} />
              <div style={{ height: "58%" }} />
              <div style={{ height: "51%" }} />
              <div style={{ height: "72%" }} />
              <div style={{ height: "81%" }} />
              <div style={{ height: "88%" }} />
            </div>
            <div className="carbon-explain-preview-foot">Monthly diverted CO₂e · example view</div>
          </div>
        </div>
      </section>

      <section className="section-pad section-pad--top0">
        <div className="section-head">
          <div>
            <div className="section-label">AVAILABLE NOW</div>
            <h2 className="section-title">Material moving in the cluster</h2>
          </div>
          <Link href="/marketplace" className="btn btn-outline">
            Browse all listings →
          </Link>
        </div>
        <div className="sample-grid">
          {samples.map((L) => (
            <ListingCard key={L.id} listing={L} variant="sample" />
          ))}
        </div>
        {samples.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 16 }}>
            <div className="empty-title">No live listings yet</div>
            <div className="empty-sub">
              Publish surplus material to show it here and in the marketplace.
            </div>
            <Link href="/listings/new" className="btn btn-primary">
              List a material
            </Link>
          </div>
        ) : null}
      </section>

      <section className="faq-section">
        <div className="section-label">QUESTIONS</div>
        <h2 className="section-title">Before you list</h2>
        <div className="faq-list">
          {FAQS.map((f, i) => {
            const open = faqOpen === i;
            return (
              <div
                key={f.q}
                className={open ? "faq-row is-open" : "faq-row"}
                onClick={() => setFaqOpen(open ? -1 : i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setFaqOpen(open ? -1 : i);
                  }
                }}
              >
                <div className="faq-row-top">
                  <div className="faq-q">{f.q}</div>
                  <div
                    className="faq-icon"
                    style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
                  >
                    +
                  </div>
                </div>
                {open ? <div className="faq-a">{f.a}</div> : null}
              </div>
            );
          })}
        </div>
      </section>

      <Footer />
    </div>
  );
}
