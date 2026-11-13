import { djangoRequest } from "@/lib/django-api";

declare global {
  type PaystackResult = { reference: string };
  type PaystackTransaction = {
    key: string;
    email: string;
    amount: number;
    currency: "NGN";
    reference: string;
    label: string;
    metadata: Record<string, unknown>;
    onSuccess: (response: PaystackResult) => void;
    onCancel: () => void;
  };
  type PaystackPopup = {
    newTransaction: (transaction: PaystackTransaction) => void;
  };

  interface Window {
    PaystackPop?: new () => PaystackPopup;
  }
}

const PAYSTACK_SCRIPT_URL = "https://js.paystack.co/v2/inline.js";

let scriptLoaded = false;
let scriptLoading: Promise<void> | null = null;

function loadPaystackScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PAYSTACK_SCRIPT_URL}"]`
    );
    if (existing) {
      scriptLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = PAYSTACK_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => {
      scriptLoading = null;
      reject(new Error("Failed to load Paystack script"));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

export type OpenPaystackOptions = {
  email: string;
  amountKobo: number;
  reference: string;
  publicKey: string;
  label?: string;
  metadata?: Record<string, unknown>;
};

export type PaymentInitialization = {
  ok: boolean;
  reference: string;
  transactionId: string;
  amountNgn: number;
  amountKobo: number;
  listingTitle: string;
  publicKey: string;
};

export async function initializePayment(listingId: string) {
  return djangoRequest<PaymentInitialization>("/pay/initialize/", {
    method: "POST",
    body: JSON.stringify({ listingId }),
  });
}

export async function openPaystack(
  options: OpenPaystackOptions
): Promise<string> {
  await loadPaystackScript();
  if (!options.publicKey) {
    throw new Error("The Django API did not return a Paystack public key.");
  }
  if (!Number.isSafeInteger(options.amountKobo) || options.amountKobo <= 0) {
    throw new Error("The Django API returned an invalid payment amount.");
  }

  return new Promise<string>((resolve, reject) => {
    if (!window.PaystackPop) {
      reject(new Error("Paystack script did not load correctly."));
      return;
    }

    const popup = new window.PaystackPop();
    popup.newTransaction({
      key: options.publicKey,
      email: options.email,
      amount: options.amountKobo,
      currency: "NGN",
      reference: options.reference,
      label: options.label ?? "EcoLoop material purchase",
      metadata: options.metadata ?? {},
      onSuccess: (response: { reference: string }) => {
        resolve(response.reference);
      },
      onCancel: () => {
        reject(new PaymentCancelledError());
      },
    });
  });
}

export class PaymentCancelledError extends Error {
  constructor() {
    super("Payment window was closed before completion.");
    this.name = "PaymentCancelledError";
  }
}

export async function cancelPaymentHold(transactionId: string) {
  return djangoRequest(`/transactions/${encodeURIComponent(transactionId)}/cancel/`, {
    method: "POST",
  });
}

export async function verifyAndFulfil(input: {
  reference: string;
  listingId: string;
}): Promise<{
  ok: boolean;
  reference: string;
  amountNgn: number;
  message: string;
}> {
  return djangoRequest("/pay/verify/", {
    method: "POST",
    body: JSON.stringify({
      reference: input.reference,
      listingId: input.listingId,
    }),
  });
}
