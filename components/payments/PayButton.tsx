"use client";

import { useState } from "react";
import { usePaystackPayment } from "react-paystack";
import { supabase } from "@/lib/supabase";

type Props = {
  transactionId: string;
  email: string;
  onPaid: (reference: string) => void | Promise<void>;
  onError: (message: string) => void;
};

export default function PayButton({
  transactionId,
  email,
  onPaid,
  onError,
}: Props) {
  const [verifying, setVerifying] = useState(false);
  const [initializing, setInitializing] = useState(false);

  const initializePayment = usePaystackPayment({
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_TEST_KEY ?? "",
    email,
    amount: 0,
    currency: "NGN",
  });

  async function verify(reference: string) {
    setVerifying(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      if (!token) throw new Error("Please log in again");

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

  async function startPayment() {
    setInitializing(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      if (!token) throw new Error("Please log in again");

      const res = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transactionId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        reference?: string;
        amountKobo?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not start payment");
      const amountKobo = json.amountKobo;
      if (
        !json.reference ||
        amountKobo == null ||
        !Number.isSafeInteger(amountKobo) ||
        amountKobo <= 0
      ) {
        throw new Error("Payment details are invalid. Please try again.");
      }

      initializePayment({
        config: {
          reference: json.reference,
          email,
          amount: amountKobo,
          currency: "NGN",
        },
        onSuccess: (response) => {
          if (response?.reference) {
            void verify(response.reference);
          } else {
            onError("Paystack did not return a payment reference. Please contact support.");
          }
        },
        onClose: () => {},
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not start payment");
    } finally {
      setInitializing(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={() => void startPayment()}
      disabled={initializing || verifying}
    >
      {initializing
        ? "Preparing payment…"
        : verifying
          ? "Verifying…"
          : "Pay with Paystack"}
    </button>
  );
}
