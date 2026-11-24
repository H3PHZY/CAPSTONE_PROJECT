"use client";

import { useState } from "react";
import {
  cancelPaymentHold,
  openPaystack,
  verifyAndFulfil,
  initializePayment,
} from "@/lib/paystack";

type PaystackButtonProps = {
  /** Buyer's email — passed directly to Paystack modal. */
  buyerEmail: string;
  buyerId: string;
  listingId: string;
  /** Price as formatted Naira string from the listing API, e.g. "52,000" */
  priceFormatted: string;
  listingTitle: string;
  /** Called after backend confirms Sold so parent can update its state. */
  onPurchaseComplete: () => void;
  variant?: "default" | "compact";
};

type Phase =
  | "idle"
  | "opening"   // Paystack modal is launching
  | "verifying" // reference sent to backend
  | "success"
  | "error";

export function PaystackButton({
  buyerEmail,
  buyerId,
  listingId,
  priceFormatted,
  listingTitle,
  onPurchaseComplete,
  variant = "default",
}: PaystackButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  async function handlePurchase() {
    setPhase("opening");
    setErrorMsg(null);

    let ref: string;
    let transactionId: string | null = null;
    try {
      const init = await initializePayment(listingId);
      transactionId = init.transactionId;
      const publicKey =
        init.publicKey ||
        process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ||
        process.env.NEXT_PUBLIC_PAYSTACK_TEST_KEY ||
        "pk_test_29571cee47495758f538fc8384ba18b70f527a83";
      ref = await openPaystack({
        email: buyerEmail,
        amountKobo: init.amountKobo,
        reference: init.reference,
        publicKey,
        label: listingTitle,
        metadata: { listingId, buyerId },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment cancelled";
      if (transactionId) {
        try {
          await cancelPaymentHold(transactionId);
        } catch (cancelError) {
          setErrorMsg(
            cancelError instanceof Error
              ? cancelError.message
              : "Could not release the payment reservation."
          );
          setPhase("error");
          return;
        }
      }
      if (msg.toLowerCase().includes("closed")) {
        setPhase("idle");
        return;
      }
      setErrorMsg(msg);
      setPhase("error");
      return;
    }

    setReference(ref);
    setPhase("verifying");

    try {
      await verifyAndFulfil({
        reference: ref,
        listingId,
      });
      setPhase("success");
      onPurchaseComplete();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Verification failed");
      setPhase("error");
    }
  }

  // ── Compact variant for header actions ──────────────────────────────────
  if (variant === "compact") {
    if (phase === "success") {
      return (
        <button type="button" className="btn btn-primary btn-sm" disabled>
          Paid ✓
        </button>
      );
    }
    const busy = phase === "opening" || phase === "verifying";
    const label =
      phase === "opening"
        ? "Opening…"
        : phase === "verifying"
          ? "Verifying…"
          : "Pay";
    return (
      <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
        <button
          type="button"
          className="btn btn-primary btn-sm paystack-btn"
          onClick={() => void handlePurchase()}
          disabled={busy}
          aria-busy={busy}
        >
          {busy && <span className="paystack-spinner" aria-hidden="true" />}
          {label}
        </button>
        {phase === "error" && errorMsg ? (
          <div className="upload-error" style={{ fontSize: 11, padding: "2px 6px" }}>
            {errorMsg}
          </div>
        ) : null}
      </div>
    );
  }

  // ── Sold / success state ──────────────────────────────────────────────────
  if (phase === "success") {
    return (
      <div className="paystack-success">
        <div className="paystack-success-icon">✓</div>
        <div className="paystack-success-title">Payment confirmed!</div>
        <div className="paystack-success-sub">
          Ref: <span className="paystack-ref">{reference}</span>
        </div>
        <p className="paystack-success-copy">
          This listing is now marked as <strong>Sold</strong>. The seller will be
          in touch to arrange collection.
        </p>
      </div>
    );
  }

  const busy = phase === "opening" || phase === "verifying";
  const label =
    phase === "opening"
      ? "Opening Paystack…"
      : phase === "verifying"
        ? "Verifying payment…"
        : `Purchase · ₦${priceFormatted}`;

  return (
    <div className="paystack-wrapper">
      <button
        id="paystack-purchase-btn"
        type="button"
        className="btn btn-primary btn-lg btn-block paystack-btn"
        onClick={() => void handlePurchase()}
        disabled={busy}
        aria-busy={busy}
      >
        {busy && <span className="paystack-spinner" aria-hidden="true" />}
        {label}
      </button>

      {phase === "error" && errorMsg ? (
        <div className="paystack-error" role="alert">
          <span className="paystack-error-icon">⚠</span>
          {errorMsg}
        </div>
      ) : null}
    </div>
  );
}
