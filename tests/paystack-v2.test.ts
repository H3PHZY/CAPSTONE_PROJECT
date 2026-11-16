// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  openPaystack,
  PaymentCancelledError,
  type OpenPaystackOptions,
} from "@/lib/paystack";

const SCRIPT_URL = "https://js.paystack.co/v2/inline.js";

function preparePaystack(
  onCreate: (transaction: {
    reference: string;
    onSuccess: (response: { reference: string }) => void;
    onCancel: () => void;
  }) => void
) {
  const script = document.createElement("script");
  script.src = SCRIPT_URL;
  document.head.appendChild(script);

  const newTransaction = vi.fn(onCreate);
  window.PaystackPop = class {
    newTransaction = newTransaction;
  };
  return newTransaction;
}

const options: OpenPaystackOptions = {
  email: "buyer@example.test",
  amountKobo: 5200000,
  reference: "ECO-reference",
  publicKey: "pk_test",
};

afterEach(() => {
  document.head.innerHTML = "";
  delete window.PaystackPop;
});

describe("Paystack inline v2 integration", () => {
  it("creates a v2 transaction with the server reference and resolves success", async () => {
    const newTransaction = preparePaystack((transaction) => {
      transaction.onSuccess({ reference: transaction.reference });
    });

    await expect(openPaystack(options)).resolves.toBe("ECO-reference");
    expect(newTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "pk_test",
        amount: 5200000,
        reference: "ECO-reference",
        currency: "NGN",
      })
    );
  });

  it("reports cancellation so the caller can release the reservation", async () => {
    const newTransaction = preparePaystack((transaction) => {
      transaction.onCancel();
    });

    await expect(openPaystack(options)).rejects.toBeInstanceOf(
      PaymentCancelledError
    );
    expect(newTransaction).toHaveBeenCalledOnce();
  });
});
