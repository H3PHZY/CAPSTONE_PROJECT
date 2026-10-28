"use client";

import { useState } from "react";
import { usePaystackPayment } from "react-paystack";
import { supabase } from "@/lib/supabase";

type Props = {
  transactionId: string;
  email: string;
  amountNgn: number;
  onPaid: (reference: string) => void | Promise<void>;
  onError: (message: string) => void;
};

export default function PayButton({
  transactionId,
  email,
  amountNgn,
  onPaid,
  onError,
}: Props) {
  const [verifying, setVerifying] = useState(false);
  const amountKobo = Math.round(amountNgn * 100); // Paystack uses kobo

  const initializePayment = usePaystackPayment({
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_TEST_KEY ?? "",
    email,
    amount: amountKobo,
    currency: "NGN",
  });

  async function verify(reference: string) {
    setVerifying(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      const res = await fetch("/api/paystack/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reference, transactionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Payment could not be verified");
      await onPaid(reference);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Payment verification failed");
    } finally {
      setVerifying(false);
    }
  }

  function startPayment() {
    initializePayment({
      config: {
        reference: `eco-${transactionId}-${Date.now()}`,
        email,
        amount: amountKobo,
        currency: "NGN",
      },
      onSuccess: (response) => {
        if (response?.reference) void verify(response.reference);
      },
      onClose: () => {},
    });
  }

  return (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={startPayment}
      disabled={verifying}
    >
      {verifying ? "Verifying…" : "Pay (test mode)"}
    </button>
  );
}
