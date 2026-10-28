"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { fetchLiveListings, fetchMyListings } from "@/lib/listings";
import { fetchCarbonImpact, fetchMyTransactions } from "@/lib/transactions";
import { CATS } from "@/lib/data";

export function DashboardPage() {
  const { prefs, profile, user, ready } = useAuth();
  const [liveCount, setLiveCount] = useState(0);
  const [co2, setCo2] = useState(0);
  const [exchanges, setExchanges] = useState(0);
  const [activity, setActivity] = useState<
    { id: string; t: string; s: string; time: string; dot: string }[]
  >([]);
  const [pulse, setPulse] = useState<{ label: string; note: string; pct: number }[]>([]);

  useEffect(() => {
    if (!ready || !user) return;
    let alive = true;
    void (async () => {
      try {
        const [mine, impact, txns, live] = await Promise.all([
          fetchMyListings(user.id),
          fetchCarbonImpact(user.id),
          fetchMyTransactions(user.id),
          fetchLiveListings().catch(() => []),
        ]);
        if (!alive) return;
        setLiveCount(mine.filter((m) => m.status === "Live").length);
        const counts = CATS.map((cat) => ({
          label: cat,
          n: live.filter((row) => row.material === cat).length,
        }));
        const max = Math.max(1, ...counts.map((c) => c.n));
        setPulse(
          counts.map((c) => ({
            label: c.label,
            note: c.n === 0 ? "None live" : `${c.n} live`,
            pct: Math.round((c.n / max) * 100),
          }))
        );
        setCo2(impact.totalCo2eKg);
        setExchanges(impact.completedCount);
        setActivity(
          txns.slice(0, 5).map((t) => ({
            id: t.id,
            t: `${t.status}: ${t.listingTitle}`,
            s: `${t.counterpartyName} · ${t.material}`,
            time: new Date(t.createdAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            dot:
              t.status === "Completed"
                ? "oklch(0.62 0.14 155)"
                : t.status === "Reserved"
                  ? "oklch(0.72 0.12 85)"
                  : "oklch(0.55 0.02 150)",
          }))
        );
      } catch {
        if (!alive) return;
      }
    })();
    return () => {
      alive = false;
    };
  }, [ready, user]);

  const name = profile?.business_name?.trim() || null;
  const goal = 3000;
  const pct = Math.min(100, Math.round((co2 / goal) * 100));

  return (
    <div className="page-shell page-shell--wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">{name ? `Welcome, ${name}` : "Welcome"}</h1>
          <div className="page-sub">
            {profile?.cluster || "Ogba"} · {liveCount} listing{liveCount === 1 ? "" : "s"}{" "}
            live
          </div>
        </div>
        <div className="page-head-actions">
          <Link href="/listings/new" className="btn btn-primary">
            + New listing
          </Link>
          <Link href="/marketplace" className="btn btn-outline">
            Browse marketplace
          </Link>
        </div>
      </div>

      <div className="todo-banner">
        <div className="todo-banner-head">
          <span className="todo-dot" />
          <div className="todo-banner-label">QUICK ACTIONS</div>
        </div>
        <div className="todo-grid">
          <div className="todo-card">
            <div>
              <div className="todo-title">List surplus material</div>
              <div className="todo-sub">Photo, confirm category, publish</div>
            </div>
            <Link href="/listings/new" className="btn btn-outline btn-sm">
              Start
            </Link>
          </div>
          <div className="todo-card">
            <div>
              <div className="todo-title">Check messages</div>
              <div className="todo-sub">Reserve a buyer and mark exchanges complete</div>
            </div>
            <Link href="/messages" className="btn btn-outline btn-sm">
              Open
            </Link>
          </div>
          <div className="todo-card">
            <div>
              <div className="todo-title">Manage listings</div>
              <div className="todo-sub">See live, reserved and sold status</div>
            </div>
            <Link href="/listings/mine" className="btn btn-outline btn-sm">
              View
            </Link>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-label">RECENT TRANSACTIONS</div>
            <div className="panel-meta">Your exchanges</div>
          </div>
          {activity.length === 0 ? (
            <div className="activity-row">
              <div className="activity-body">
                <div className="activity-title">No transactions yet</div>
                <div className="activity-sub">
                  When you reserve a buyer or mark an exchange completed, it shows up here.
                </div>
              </div>
            </div>
          ) : (
            activity.map((a) => (
              <Link key={a.id} href={`/transactions/${a.id}`} className="activity-row">
                <div className="activity-dot" style={{ background: a.dot }} />
                <div className="activity-body">
                  <div className="activity-title">{a.t}</div>
                  <div className="activity-sub">{a.s}</div>
                </div>
                <div className="activity-time">{a.time}</div>
              </Link>
            ))
          )}
          <div className="panel-foot">
            <Link href="/transactions" className="btn btn-outline btn-sm">
              All transactions
            </Link>
          </div>
        </div>

        <div className="dash-side">
          <div className="impact-snap">
            <div className="impact-snap-label">YOUR IMPACT SNAPSHOT</div>
            <div className="impact-snap-row">
              <div className="impact-snap-v">{co2.toLocaleString()}</div>
              <div className="impact-snap-unit">kg CO₂e diverted</div>
            </div>
            <div className="progress-track progress-track--dark">
              <div
                className="progress-fill progress-fill--green"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="impact-snap-meta">
              <span>
                {pct}% of your {goal.toLocaleString()} kg diversion goal
              </span>
              <span>
                {exchanges} exchange{exchanges === 1 ? "" : "s"}
              </span>
            </div>
            {prefs.carbonImpact ? (
              <Link href="/impact" className="btn btn-ghost-light btn-block">
                See full impact
              </Link>
            ) : null}
          </div>

          <div className="panel panel--pad">
            <div className="panel-label">MARKETPLACE MIX · LIVE LOTS</div>
            <div className="pulse-list">
              {pulse.map((p) => (
                <div key={p.label}>
                  <div className="pulse-row">
                    <div className="pulse-label">{p.label}</div>
                    <div className="pulse-note">{p.note}</div>
                  </div>
                  <div className="bar-track">
                    <div
                      className={p.pct < 30 ? "bar-fill bar-fill--muted" : "bar-fill"}
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="panel-hint">
              Share of live listings by material stream in the cluster.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}