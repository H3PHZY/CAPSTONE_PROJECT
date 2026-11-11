/**
 * Client-side Paystack payment helper.
 *
 * Loads the Paystack inline JS once, then exposes `openPaystack` which
 * pops the Paystack modal and resolves with the transaction reference on
 * success, or rejects if the user closes/cancels.
 *
 * Env required (browser):
 *   NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxx
 */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PaystackPop?: any;
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
    script.onerror = () => reject(new Error("Failed to load Paystack script"));
    document.head.appendChild(script);
  });

  return scriptLoading;
}

export type OpenPaystackOptions = {
  email: string;
  /** Price in Naira (integer). Converted to kobo internally. */
  amountNgn: number;
  /** Server-generated structured reference */
  reference?: string;
  /** Shown in the Paystack modal as the product name. */
  label?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Initializes a payment on the backend to obtain a structured, server-generated reference
 * and verify the lot's current availability and price.
 */
export async function initializePayment(opts: {
  listingId: string;
  buyerId?: string;
}): Promise<{
  ok: boolean;
  reference: string;
  amountNgn: number;
  amountKobo: number;
  listingTitle?: string;
  publicKey?: string;
}> {
  // Try Django backend if token available, else Next.js route
  const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_API_URL || "http://127.0.0.1:8000/api";
  const token = typeof window !== "undefined" ? localStorage.getItem("ecoloop_access_token") : null;

  try {
    const res = await fetch(`${djangoUrl}/pay/initialize/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ listingId: opts.listingId }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Continue to Next.js route fallback
  }

  const nextRes = await fetch("/api/pay/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });

  const data = await nextRes.json();
  if (!nextRes.ok) {
    throw new Error(data.error || "Failed to initialize payment on the server.");
  }
  return data;
}

/**
 * Opens the Paystack checkout modal.
 * Resolves with the Paystack `reference` string on success.
 * Rejects if the user closes the modal without paying.
 */
export async function openPaystack(opts: OpenPaystackOptions): Promise<string> {
  await loadPaystackScript();

  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error(
      "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is not set. Add it to .env.local."
    );
  }

  return new Promise<string>((resolve, reject) => {
    if (!window.PaystackPop) {
      reject(new Error("Paystack script did not load correctly."));
      return;
    }

    const handler = window.PaystackPop.setup({
      key: publicKey,
      email: opts.email,
      amount: Math.round(opts.amountNgn * 100), // NGN → kobo
      currency: "NGN",
      ref: opts.reference, // Server-generated reference
      label: opts.label ?? "EcoLoop material purchase",
      metadata: opts.metadata ?? {},
      callback: (response: { reference: string }) => {
        resolve(response.reference);
      },
      onClose: () => {
        reject(new Error("Payment window was closed before completion."));
      },
    });

    handler.openIframe();
  });
}

/**
 * Calls the backend /api/pay/verify route to check the reference and
 * mark the listing as Sold. Returns the API JSON on success, throws on error.
 */
export async function verifyAndFulfil(opts: {
  reference: string;
  listingId: string;
  buyerId: string;
  expectedNgn: number;
}): Promise<{ ok: boolean; reference: string; amountNgn: number; message: string }> {
  const res = await fetch("/api/pay/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(
      (json as { error?: string; code?: string }).error ||
        `Verification failed (${res.status})`
    );
  }

  return json as { ok: boolean; reference: string; amountNgn: number; message: string };
}
