"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { formatPriceNgn } from "@/lib/listings";
import {
  fetchMyTransactions,
  transactionRef,
  type TransactionView,
} from "@/lib/transactions";

type RoleFilter = "all" | "buying" | "selling";

function payLabel(t: TransactionView) {
  if (t.paidAt) return "Paid";
  if (t.status === "Reserved" && t.priceNgn && t.priceNgn > 0) return "Unpaid";
  if (t.status === "Completed") return "—";
  return "—";
}

function statusClass(status: string) {
  return `status-pill status-pill--${status.toLowerCase()}`;
}

export function TransactionsPage() {
  const { user, ready, openAuth } = useAuth();
  const [rows, setRows] = useState<TransactionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<RoleFilter>("all");

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setLoading(false);
      openAuth("login", "/transactions");
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);
    void fetchMyTransactions(user.id)
      .then((list) => {
        if (alive) setRows(list);
      })
      .catch((err) => {
        if (alive) {
          setError(err instanceof Error ? err.message : "Could not load transactions");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [ready, user, openAuth]);

  const visible = useMemo(() => {
    if (!user) return [];
    if (role === "buying") return rows.filter((t) => t.buyerId === user.id);
    if (role === "selling") return rows.filter((t) => t.sellerId === user.id);
    return rows;
  }, [rows, role, user]);

  if (!ready || loading) {
    return (
      <div className="page-shell page-shell--wide">
        <h1 className="page-title page-title--mb">Transactions</h1>
        <div className="page-sub">Loading your exchanges…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-shell page-shell--wide">
        <div className="empty-state">
          <div className="empty-title">Sign in to view transactions</div>
          <button type="button" className="btn btn-primary" onClick={() => openAuth("login", "/transactions")}>
            Log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Transactions</h1>
          <div className="page-sub">Every exchange you buy or sell, with payment status</div>
        </div>
      </div>

      <div className="txn-filters">
        {(
          [
            ["all", "All"],
            ["buying", "Buying"],
            ["selling", "Selling"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={role === id ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
            onClick={() => setRole(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <div className="upload-error">{error}</div> : null}

      <div className="panel panel--flush table-scroll">
        <div className="txn-list-head">
          <div>REF</div>
          <div>LISTING</div>
          <div>ROLE</div>
          <div>COUNTERPARTY</div>
          <div>AMOUNT</div>
          <div>STATUS</div>
          <div>PAYMENT</div>
          <div />
        </div>
        {visible.length === 0 ? (
          <div className="txn-list-row">
            <div className="mine-cell" style={{ gridColumn: "1 / -1" }}>
              No transactions in this view yet. Open a listing to start an exchange.
            </div>
          </div>
        ) : (
          visible.map((t) => {
            const selling = t.sellerId === user.id;
            return (
              <Link key={t.id} href={`/transactions/${t.id}`} className="txn-list-row txn-list-row--link">
                <div className="mine-cell mine-cell--mono">{transactionRef(t.id)}</div>
                <div>
                  <div className="mine-title">{t.listingTitle}</div>
                  <div className="mine-ref">
                    {t.material} · {t.weightKg} kg
                  </div>
                </div>
                <div className="mine-cell">{selling ? "Seller" : "Buyer"}</div>
                <div className="mine-cell">{t.counterpartyName}</div>
                <div className="mine-cell mine-cell--mono">
                  {t.priceNgn && t.priceNgn > 0 ? `₦${formatPriceNgn(t.priceNgn)}` : "—"}
                </div>
                <div>
                  <span className={statusClass(t.status)}>{t.status}</span>
                </div>
                <div className="mine-cell">{payLabel(t)}</div>
                <div className="mine-cell">View</div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}