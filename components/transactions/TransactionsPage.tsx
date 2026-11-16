"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  fetchMyTransactions,
  formatTransactionAmount,
  transactionRef,
  type TransactionView,
} from "@/lib/transactions";
import { djangoDisputes, type DjangoDispute } from "@/lib/django-api";
import { canRaiseDispute } from "@/lib/disputes";

type RoleFilter = "all" | "buying" | "selling";

function payLabel(t: TransactionView) {
  if (t.paidAt) return "Paid";
  if (t.status === "Reserved" && t.amountNgn && t.amountNgn > 0) return "Unpaid";
  if (t.status === "Completed") return "—";
  return "—";
}

function statusClass(status: string) {
  return `status-pill status-pill--${status.toLowerCase()}`;
}

const EMPTY_TRANSACTIONS: TransactionView[] = [];

export function TransactionsPage() {
  const { user, ready, openAuth } = useAuth();
  const [role, setRole] = useState<RoleFilter>("all");
  const [transactionResult, setTransactionResult] = useState<{
    userId: string;
    rows: TransactionView[];
    error: string | null;
  } | null>(null);
  const [disputeResult, setDisputeResult] = useState<{
    userId: string;
    disputes: DjangoDispute[];
    error: string | null;
  } | null>(null);
  const [disputeSubmitError, setDisputeSubmitError] = useState<string | null>(null);
  const [disputeSuccess, setDisputeSuccess] = useState<string | null>(null);
  const [disputeTransactionId, setDisputeTransactionId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const currentTransactions =
    user && transactionResult?.userId === user.id ? transactionResult : null;
  const currentDisputes = user && disputeResult?.userId === user.id ? disputeResult : null;
  const rows = currentTransactions?.rows ?? EMPTY_TRANSACTIONS;
  const disputes = currentDisputes?.disputes ?? [];
  const loading = Boolean(user && !currentTransactions);
  const disputeLoading = Boolean(user && !currentDisputes);
  const error = currentTransactions?.error ?? null;
  const disputeError = disputeSubmitError ?? currentDisputes?.error ?? null;

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      openAuth("login", "/transactions");
      return;
    }

    let alive = true;
    void fetchMyTransactions()
      .then((list) => {
        if (alive) setTransactionResult({ userId: user.id, rows: list, error: null });
      })
      .catch((err) => {
        if (alive) {
          setTransactionResult({
            userId: user.id,
            rows: [],
            error: err instanceof Error ? err.message : "Could not load transactions",
          });
        }
      });
    void djangoDisputes
      .fetchMine()
      .then((list) => {
        if (alive) setDisputeResult({ userId: user.id, disputes: list, error: null });
      })
      .catch((err) => {
        if (alive) {
          setDisputeResult({
            userId: user.id,
            disputes: [],
            error: err instanceof Error ? err.message : "Could not load disputes",
          });
        }
      });

    return () => {
      alive = false;
    };
  }, [ready, user, openAuth]);

  async function submitDispute(event: React.FormEvent, transactionId: string) {
    event.preventDefault();
    if (!user) return;
    const reason = disputeReason.trim();
    if (!reason) {
      setDisputeSubmitError("Enter a reason for the dispute.");
      return;
    }

    setSubmittingDispute(true);
    setDisputeSubmitError(null);
    setDisputeSuccess(null);
    try {
      const created = await djangoDisputes.create({
        transaction_id: transactionId,
        reason,
      });
      setDisputeResult((current) => ({
        userId: user.id,
        disputes: [
          created,
          ...(current?.userId === user.id ? current.disputes : []),
        ],
        error: null,
      }));
      setDisputeReason("");
      setDisputeTransactionId(null);
      setDisputeSuccess("Your dispute was submitted.");
    } catch (err) {
      setDisputeSubmitError(
        err instanceof Error ? err.message : "Could not submit dispute"
      );
    } finally {
      setSubmittingDispute(false);
    }
  }

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
                  {t.amountNgn && t.amountNgn > 0
                    ? formatTransactionAmount(t.amountNgn, t.currency)
                    : "—"}
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

      <section className="panel panel--pad" aria-labelledby="disputes-heading">
        <div className="panel-label" id="disputes-heading">
          DISPUTES
        </div>
        <p className="page-sub">
          Buyers can report an issue with a paid exchange. Disputes on your transactions are listed
          here.
        </p>
        {disputeError ? <div className="upload-error">{disputeError}</div> : null}
        {disputeSuccess ? <div className="field-foot" role="status">{disputeSuccess}</div> : null}
        <div className="form-stack">
          <div>
            <div className="field-label">Your disputes</div>
            {disputeLoading ? (
              <div className="field-foot">Loading disputes…</div>
            ) : disputes.length === 0 ? (
              <div className="field-foot">No disputes on your transactions.</div>
            ) : (
              <div className="pipeline-items">
                {disputes.map((dispute) => {
                  const transaction = rows.find((row) => row.id === dispute.transaction_id);
                  return (
                    <div className="pipeline-item" key={dispute.id}>
                      <div className="pipeline-item-t">
                        {transaction ? (
                          <Link href={`/transactions/${transaction.id}`}>
                            {transaction.listingTitle}
                          </Link>
                        ) : (
                          `Transaction ${transactionRef(dispute.transaction_id)}`
                        )}
                        {" · "}
                        <span className={statusClass(dispute.status)}>{dispute.status}</span>
                      </div>
                      <div className="pipeline-item-s">{dispute.reason}</div>
                      <div className="pipeline-item-s">
                        Opened {new Date(dispute.created_at).toLocaleString("en-GB")}
                        {dispute.resolution_note ? ` · ${dispute.resolution_note}` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <div className="field-label">Open a dispute</div>
            {rows.filter((transaction) => transaction.buyerId === user.id && transaction.paidAt)
              .length === 0 ? (
              <div className="field-foot">No paid buyer transactions are eligible for a dispute.</div>
            ) : (
              <div className="form-stack">
                {rows
                  .filter((transaction) => transaction.buyerId === user.id && transaction.paidAt)
                  .map((transaction) => {
                    const hasOpenDispute = !canRaiseDispute(transaction, user.id, disputes);
                    const formOpen = disputeTransactionId === transaction.id;
                    return (
                      <div className="pipeline-item" key={transaction.id}>
                        <div className="pipeline-item-t">{transaction.listingTitle}</div>
                        <div className="pipeline-item-s">
                          {transactionRef(transaction.id)} ·{" "}
                          {formatTransactionAmount(transaction.amountNgn, transaction.currency)}
                        </div>
                        {hasOpenDispute ? (
                          <div className="field-foot">An open dispute already exists.</div>
                        ) : formOpen ? (
                          <form
                            className="form-stack"
                            onSubmit={(event) => void submitDispute(event, transaction.id)}
                          >
                            <label className="field-label" htmlFor={`dispute-reason-${transaction.id}`}>
                              Reason for dispute
                            </label>
                            <textarea
                              id={`dispute-reason-${transaction.id}`}
                              className="input"
                              rows={4}
                              maxLength={4000}
                              value={disputeReason}
                              onChange={(event) => setDisputeReason(event.target.value)}
                              required
                            />
                            <div className="form-row-2">
                              <button
                                type="submit"
                                className="btn btn-primary btn-sm"
                                disabled={submittingDispute || !disputeReason.trim()}
                              >
                                {submittingDispute ? "Submitting…" : "Submit dispute"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => {
                                  setDisputeTransactionId(null);
                                  setDisputeReason("");
                                }}
                                disabled={submittingDispute}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setDisputeSubmitError(null);
                              setDisputeSuccess(null);
                              setDisputeTransactionId(transaction.id);
                              setDisputeReason("");
                            }}
                          >
                            Report an issue
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}