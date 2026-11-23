"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { fetchMyListings, publishOwnedListing } from "@/lib/listings";
import {
  fetchMyTransactions,
  formatTransactionAmount,
  type TransactionView,
} from "@/lib/transactions";
import type { ListingStatus, MyListing } from "@/lib/types";

const EMPTY_LISTINGS: MyListing[] = [];
const EMPTY_TRANSACTIONS: TransactionView[] = [];

export function MyListingsPage() {
  const { user, profile, ready } = useAuth();
  const [listingRows, setListingRows] = useState<MyListing[]>([]);
  const [transactionRows, setTransactionRows] = useState<TransactionView[]>([]);
  const [pipeline, setPipeline] = useState<
    { stage: string; count: number; items: { t: string; s: string; href: string }[] }[]
  >([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const rows =
    user && loadedUserId === user.id ? listingRows : EMPTY_LISTINGS;
  const txns =
    user && loadedUserId === user.id ? transactionRows : EMPTY_TRANSACTIONS;
  const loading = !ready || Boolean(user && loadedUserId !== user.id);

  async function publishDraft(id: string) {
    setPublishingId(id);
    setError(null);
    try {
      await publishOwnedListing(id);
      setListingRows((current) =>
        current.map((listing) =>
          listing.id === id ? { ...listing, status: "Live" } : listing
        )
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not publish draft");
    } finally {
      setPublishingId(null);
    }
  }

  useEffect(() => {
    if (!ready) return;
    if (!user) return;

    let active = true;
    void Promise.all([fetchMyListings(), fetchMyTransactions()])
      .then(([listings, txns]) => {
        if (!active) return;
        setListingRows(listings);
        setTransactionRows(txns.filter((t) => String(t.sellerId) === String(user.id)));
        setLoadedUserId(String(user.id));
        setError(null);
        const selling = txns.filter((t) => String(t.sellerId) === String(user.id));
        const interest = selling.filter((t) => t.status === "Interest");
        const reserved = selling.filter((t) => t.status === "Reserved");
        const completed = selling.filter((t) => t.status === "Completed");
        setPipeline([
          {
            stage: "Interest",
            count: interest.length,
            items: interest.slice(0, 3).map((t) => ({
              t: t.listingTitle,
              s: t.counterpartyName,
              href: `/transactions/${t.id}`,
            })),
          },
          {
            stage: "Reserved",
            count: reserved.length,
            items: reserved.slice(0, 3).map((t) => ({
              t: t.listingTitle,
              s: t.counterpartyName,
              href: `/transactions/${t.id}`,
            })),
          },
          {
            stage: "Completed",
            count: completed.length,
            items: completed.slice(0, 3).map((t) => ({
              t: t.listingTitle,
              s: `${t.counterpartyName}${
                t.amountNgn && t.amountNgn > 0
                  ? ` · ${formatTransactionAmount(t.amountNgn, t.currency)}`
                  : ""
              }${t.co2eKg != null ? ` · ${t.co2eKg} kg CO₂e` : ""}`,
              href: `/transactions/${t.id}`,
            })),
          },
        ]);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load your listings");
        setLoadedUserId(String(user.id));
      });

    return () => {
      active = false;
    };
  }, [ready, user]);

  const finance = useMemo(() => {
    const priceOf = (t: TransactionView) =>
      t.amountNgn && t.amountNgn > 0 ? t.amountNgn : 0;
    const currency = txns.find((t) => t.amountNgn != null)?.currency ?? "NGN";
    const paid = txns.filter(
      (t) =>
        String(t.sellerId) === String(user?.id) &&
        (Boolean(t.paidAt) || t.status === "Completed")
    );
    let earned = paid.reduce((sum, t) => sum + priceOf(t), 0);
    let paidCount = paid.length;

    // Also account for listings marked Sold in case transaction sync is delayed
    const soldListings = rows.filter((r) => r.status === "Sold");
    if (soldListings.length > paidCount) {
      const soldTotal = soldListings.reduce(
        (sum, r) => sum + (parseFloat(String(r.price).replace(/,/g, "")) || 0),
        0
      );
      if (soldTotal > earned) {
        earned = soldTotal;
        paidCount = soldListings.length;
      }
    }

    const awaiting = txns.filter(
      (t) =>
        String(t.sellerId) === String(user?.id) &&
        t.status === "Reserved" &&
        !t.paidAt &&
        priceOf(t) > 0
    );
    const awaitingTotal = awaiting.reduce((sum, t) => sum + priceOf(t), 0);
    return [
      {
        k: "RECEIVED",
        v: formatTransactionAmount(earned, currency),
        sub: `${paidCount} paid exchange${paidCount === 1 ? "" : "s"}`,
      },
      {
        k: "AWAITING PAYMENT",
        v: formatTransactionAmount(awaitingTotal, currency),
        sub: `${awaiting.length} reserved deal${awaiting.length === 1 ? "" : "s"}`,
      },
    ];
  }, [txns, rows, user?.id]);

  const stats = useMemo(() => {
    const live = rows.filter((r) => r.status === "Live");
    const reserved = rows.filter((r) => r.status === "Reserved");
    const sold = rows.filter((r) => r.status === "Sold");
    const liveWeight = live.reduce((sum, r) => sum + r.weight, 0);
    const soldWeight = sold.reduce((sum, r) => sum + r.weight, 0);
    const views = rows.reduce((sum, r) => sum + r.views, 0);
    return [
      { k: "LIVE", v: String(live.length), sub: `${liveWeight.toLocaleString()} kg available` },
      { k: "RESERVED", v: String(reserved.length), sub: "buyer hold" },
      { k: "SOLD", v: String(sold.length), sub: `${soldWeight.toLocaleString()} kg diverted` },
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

      <div className="stats-row stats-row--finance">
        {finance.map((s) => (
          <div key={s.k} className="stat-card stat-card--finance">
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
            <div className="mine-cell mine-cell--mono">{m.views}</div>
            <div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {m.status === "Draft" ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-xs"
                    onClick={() => void publishDraft(m.id)}
                    disabled={publishingId !== null}
                  >
                    {publishingId === m.id ? "Publishing…" : "Publish"}
                  </button>
                ) : null}
                <Link href={`/listings/${m.id}/manage`} className="btn btn-outline btn-xs">
                  Manage
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="panel panel--pad pipeline-wrap">
        <div className="panel-head" style={{ padding: 0, border: 0 }}>
          <div className="panel-label">TRANSACTION PIPELINE</div>
          <Link href="/transactions" className="btn btn-outline btn-sm">
            All transactions
          </Link>
        </div>
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
                    <Link
                      key={`${p.stage}-${it.href}`}
                      href={it.href}
                      className="pipeline-item"
                    >
                      <div className="pipeline-item-t">{it.t}</div>
                      <div className="pipeline-item-s">{it.s}</div>
                    </Link>
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