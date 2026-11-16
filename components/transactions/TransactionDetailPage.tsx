"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  fetchTransactionById,
  formatTransactionAmount,
  transactionRef,
  type TransactionView,
} from "@/lib/transactions";

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TransactionDetailPage({ id }: { id: string }) {
  const { user, ready, openAuth } = useAuth();
  const [result, setResult] = useState<{
    key: string;
    txn: TransactionView | null;
    error: string | null;
  } | null>(null);
  const requestKey = ready && user ? `${id}:${user.id}` : null;
  const currentResult = requestKey && result?.key === requestKey ? result : null;
  const txn = currentResult?.txn ?? null;
  const error = currentResult?.error ?? null;
  const loading = Boolean(requestKey && !currentResult);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      openAuth("login", `/transactions/${id}`);
      return;
    }

    let alive = true;
    const key = `${id}:${user.id}`;
    void fetchTransactionById(id)
      .then((row) => {
        if (!alive) return;
        setResult({
          key,
          txn: row,
          error: row ? null : "This transaction was not found, or you are not a party to it.",
        });
      })
      .catch((err) => {
        if (alive) {
          setResult({
            key,
            txn: null,
            error: err instanceof Error ? err.message : "Could not load this transaction",
          });
        }
      });

    return () => {
      alive = false;
    };
  }, [ready, user, id, openAuth]);

  if (!ready || loading) {
    return (
      <div className="page-shell page-shell--wide">
        <div className="page-sub">Loading transaction…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-shell page-shell--wide">
        <div className="empty-state">
          <div className="empty-title">Sign in to view this transaction</div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openAuth("login", `/transactions/${id}`)}
          >
            Log in
          </button>
        </div>
      </div>
    );
  }

  if (error || !txn) {
    return (
      <div className="page-shell page-shell--wide">
        <div className="empty-state">
          <div className="empty-title">{error || "Transaction not found"}</div>
          <Link href="/transactions" className="btn btn-outline">
            All transactions
          </Link>
        </div>
      </div>
    );
  }

  const selling = txn.sellerId === user.id;
  const priced = Boolean(txn.amountNgn && txn.amountNgn > 0);

  return (
    <div className="page-shell page-shell--wide">
      <div className="page-head">
        <div>
          <div className="section-label">{transactionRef(txn.id)}</div>
          <h1 className="page-title">{txn.listingTitle}</h1>
          <div className="page-sub">
            You are the {selling ? "seller" : "buyer"} · {txn.counterpartyName}
          </div>
        </div>
        <div className="page-head-actions">
          <Link href="/transactions" className="btn btn-outline">
            All transactions
          </Link>
          <Link href={`/messages?listing=${txn.listingId}`} className="btn btn-primary">
            Open messages
          </Link>
        </div>
      </div>

      <div className="txn-detail-grid">
        <div className="panel panel--pad">
          <div className="panel-label">EXCHANGE</div>
          <dl className="txn-detail-dl">
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`status-pill status-pill--${txn.status.toLowerCase()}`}>
                  {txn.status}
                </span>
              </dd>
            </div>
            <div>
              <dt>Your role</dt>
              <dd>{selling ? "Seller" : "Buyer"}</dd>
            </div>
            <div>
              <dt>Counterparty</dt>
              <dd>{txn.counterpartyName}</dd>
            </div>
            <div>
              <dt>Material</dt>
              <dd>
                {txn.material} · {txn.weightKg} kg
              </dd>
            </div>
            <div>
              <dt>Opened</dt>
              <dd>{formatWhen(txn.createdAt)}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>{formatWhen(txn.completedAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="panel panel--pad">
          <div className="panel-label">PAYMENT</div>
          <dl className="txn-detail-dl">
            <div>
              <dt>Amount</dt>
              <dd className="txn-detail-amount">
                {priced
                  ? formatTransactionAmount(txn.amountNgn, txn.currency)
                  : "No price set"}
              </dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{txn.paidAt ? "Confirmed" : priced ? "Awaiting payment" : "Not required"}</dd>
            </div>
            <div>
              <dt>Paid at</dt>
              <dd>{formatWhen(txn.paidAt)}</dd>
            </div>
            {txn.co2eKg != null ? (
              <div>
                <dt>CO₂e logged</dt>
                <dd>{txn.co2eKg.toLocaleString()} kg</dd>
              </div>
            ) : null}
          </dl>
          <div className="txn-detail-actions">
            <Link href={`/marketplace/${txn.listingId}`} className="btn btn-outline btn-sm">
              View listing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}