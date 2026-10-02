"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { fetchMyListings } from "@/lib/listings";
import { fetchMyTransactions } from "@/lib/transactions";
import type { ListingStatus, MyListing } from "@/lib/types";

function statusClass(status: ListingStatus) {
  return `status-pill status-pill--${status.toLowerCase()}`;
}

export function MyListingsPage() {
  const { user, profile, ready } = useAuth();
  const [rows, setRows] = useState<MyListing[]>([]);
  const [pipeline, setPipeline] = useState<
    { stage: string; count: number; items: { t: string; s: string }[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    void Promise.all([fetchMyListings(user.id), fetchMyTransactions(user.id)])
      .then(([listings, txns]) => {
        if (!active) return;
        setRows(listings);
        const interest = txns.filter((t) => t.status === "Interest");
        const reserved = txns.filter((t) => t.status === "Reserved");
        const completed = txns.filter((t) => t.status === "Completed");
        setPipeline([
          {
            stage: "Interest",
            count: interest.length,
            items: interest.slice(0, 3).map((t) => ({
              t: t.listingTitle,
              s: t.counterpartyName,
            })),
          },
          {
            stage: "Reserved",
            count: reserved.length,
            items: reserved.slice(0, 3).map((t) => ({
              t: t.listingTitle,
              s: t.counterpartyName,
            })),
          },
          {
            stage: "Completed",
            count: completed.length,
            items: completed.slice(0, 3).map((t) => ({
              t: t.listingTitle,
              s: `${t.counterpartyName}${t.co2eKg != null ? ` · ${t.co2eKg} kg CO₂e` : ""}`,
            })),
          },
        ]);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load your listings");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ready, user]);

  const stats = useMemo(() => {
    const live = rows.filter((r) => r.status === "Live").length;
    const reserved = rows.filter((r) => r.status === "Reserved").length;
    const sold = rows.filter((r) => r.status === "Sold").length;
    const views = rows.reduce((sum, r) => sum + r.views, 0);
    return [
      { k: "LIVE", v: String(live), sub: "visible in marketplace" },
      { k: "RESERVED", v: String(reserved), sub: "buyer hold" },
      { k: "SOLD", v: String(sold), sub: "completed exchanges" },
      { k: "VIEWS", v: String(views), sub: "across your listings" },
    ];
  }, [rows]);

  return (
    <div className="page-shell page-shell--wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">My listings</h1>
          <div className="page-sub">
            Seller workspace · {profile?.cluster || "Ogba"} Industrial Estate
          </div>
        </div>
        <Link href="/listings/new" className="btn btn-primary">
          + New listing
        </Link>
      </div>

      <div className="stats-row">
        {stats.map((s) => (
          <div key={s.k} className="stat-card">
            <div className="stat-card-k">{s.k}</div>
            <div className="stat-card-v">{s.v}</div>
            <div className="stat-card-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {error ? <div className="upload-error">{error}</div> : null}

      <div className="panel panel--flush table-scroll">
        <div className="mine-table-head">
          <div>PHOTO</div>
          <div>MATERIAL</div>
          <div>CATEGORY</div>
          <div>WEIGHT</div>
          <div>PRICE</div>
          <div>STATUS</div>
          <div>VIEWS</div>
          <div />
        </div>
        {loading ? (
          <div className="mine-table-row">
            <div className="mine-cell" style={{ gridColumn: "1 / -1" }}>
              Loading your listings…
            </div>
          </div>
        ) : null}
        {!loading && rows.length === 0 ? (
          <div className="mine-table-row">
            <div className="mine-cell" style={{ gridColumn: "1 / -1" }}>
              No listings yet. Publish your first surplus material to see it here.
            </div>
          </div>
        ) : null}
        {rows.map((m) => (
          <div key={m.id} className="mine-table-row">
            <div
              className="mine-thumb"
              style={
                m.photoUrl
                  ? {
                      backgroundImage: `url(${m.photoUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
            />
            <div>
              <div className="mine-title">{m.title}</div>
              <div className="mine-ref">
                {m.ref} · {m.date}
              </div>
            </div>
            <div className="mine-cell">{m.material}</div>
            <div className="mine-cell mine-cell--mono">{m.weight} kg</div>
            <div className="mine-cell mine-cell--mono">₦{m.price}</div>
            <div>
              <span className={statusClass(m.status)}>{m.status}</span>
            </div>
            <div className="mine-cell mine-cell--mono">{m.views}</div>
            <div>
              <Link href={`/listings/${m.id}/manage`} className="btn btn-outline btn-xs">
                Manage
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="panel panel--pad pipeline-wrap">
        <div className="panel-label">TRANSACTION PIPELINE</div>
        <div className="pipeline-grid">
          {pipeline.map((p) => (
            <div key={p.stage} className="pipeline-col">
              <div className="pipeline-col-head">
                <div className="pipeline-stage">{p.stage}</div>
                <div className="pipeline-count">{p.count}</div>
              </div>
              <div className="pipeline-items">
                {p.items.length === 0 ? (
                  <div className="pipeline-item">
                    <div className="pipeline-item-s">None yet</div>
                  </div>
                ) : (
                  p.items.map((it) => (
                    <div key={`${p.stage}-${it.t}-${it.s}`} className="pipeline-item">
                      <div className="pipeline-item-t">{it.t}</div>
                      <div className="pipeline-item-s">{it.s}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
