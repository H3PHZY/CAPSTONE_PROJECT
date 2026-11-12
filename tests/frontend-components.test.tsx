// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { djangoRequest } from "@/lib/django-api";
import { handleError } from "@/lib/django-auth";
import { PaystackButton } from "@/components/marketplace/PaystackButton";
import {
  initializePayment,
  openPaystack,
  verifyAndFulfil,
} from "@/lib/paystack";

vi.mock("@/lib/django-api", () => ({
  djangoRequest: vi.fn(),
}));

vi.mock("@/lib/paystack", () => ({
  initializePayment: vi.fn(),
  openPaystack: vi.fn(),
  verifyAndFulfil: vi.fn(),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

function AuthState() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="auth-user">{auth.user?.email ?? "anonymous"}</span>
      <button type="button" onClick={() => void auth.login("buyer@example.test", "password123")}>
        Sign in
      </button>
      <button type="button" onClick={() => void auth.logout()}>
        Sign out
      </button>
      <button
        type="button"
        onClick={() => {
          void handleError(new Response(null, { status: 401 })).catch(() => undefined);
        }}
      >
        Expire session
      </button>
    </div>
  );
}

describe("Paystack checkout", () => {
  it("initializes, verifies, and reports a successful purchase", async () => {
    vi.mocked(initializePayment).mockResolvedValue({
      ok: true,
      amountKobo: 5200000,
      amountNgn: 52000,
      reference: "ECO-listing-buyer",
      listingTitle: "Copper offcuts",
      publicKey: "pk_test",
    });
    vi.mocked(openPaystack).mockResolvedValue("ECO-listing-buyer");
    vi.mocked(verifyAndFulfil).mockResolvedValue({
      ok: true,
      reference: "ECO-listing-buyer",
      amountNgn: 52000,
      message: "Payment verified.",
    });
    const onPurchaseComplete = vi.fn();

    render(
      <PaystackButton
        buyerEmail="buyer@example.test"
        buyerId="buyer-1"
        listingId="listing-1"
        priceFormatted="52,000"
        listingTitle="Copper offcuts"
        onPurchaseComplete={onPurchaseComplete}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /purchase/i }));

    expect(await screen.findByText("Payment confirmed!")).toBeTruthy();
    expect(initializePayment).toHaveBeenCalledWith("listing-1");
    expect(openPaystack).toHaveBeenCalledWith(
      expect.objectContaining({ amountKobo: 5200000, reference: "ECO-listing-buyer" })
    );
    expect(verifyAndFulfil).toHaveBeenCalledWith({
      reference: "ECO-listing-buyer",
      listingId: "listing-1",
    });
    expect(onPurchaseComplete).toHaveBeenCalledOnce();
  });

  it("shows the exact payment verification error", async () => {
    vi.mocked(initializePayment).mockResolvedValue({
      ok: true,
      amountKobo: 5200000,
      amountNgn: 52000,
      reference: "ECO-listing-buyer",
      listingTitle: "Copper offcuts",
      publicKey: "pk_test",
    });
    vi.mocked(openPaystack).mockResolvedValue("ECO-listing-buyer");
    vi.mocked(verifyAndFulfil).mockRejectedValue(
      new Error("Payment reference has already been used.")
    );

    render(
      <PaystackButton
        buyerEmail="buyer@example.test"
        buyerId="buyer-1"
        listingId="listing-1"
        priceFormatted="52,000"
        listingTitle="Copper offcuts"
        onPurchaseComplete={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /purchase/i }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Payment reference has already been used."
    );
  });
});

describe("authentication context", () => {
  it("stores tokens on login and clears the session on logout", async () => {
    vi.mocked(djangoRequest).mockResolvedValue({
      user: {
        id: "buyer-1",
        email: "buyer@example.test",
        profile: {
          business_name: "GreenWay",
          phone: "+2348000000000",
          cluster: "Ikeja",
          zone: "Ikeja",
          address: "",
          date_of_birth: "1990-01-01",
          sells: false,
          buys: true,
          carbon_impact: false,
          research_consent: false,
          verified: true,
          avatar_url: null,
          display_avatar_url: null,
          lat: null,
          lng: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      },
      tokens: { access: "access-token", refresh: "refresh-token" },
    } as never);

    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>
    );

    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(screen.getByTestId("auth-user").textContent).toBe("buyer@example.test");
    });
    expect(localStorage.getItem("ecoloop_access_token")).toBe("access-token");
    expect(localStorage.getItem("ecoloop_refresh_token")).toBe("refresh-token");

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByTestId("auth-user").textContent).toBe("anonymous");
    expect(localStorage.getItem("ecoloop_access_token")).toBeNull();
    expect(localStorage.getItem("ecoloop_refresh_token")).toBeNull();
  });

  it("clears the authenticated user when an API request reports an expired session", async () => {
    vi.mocked(djangoRequest).mockResolvedValue({
      user: {
        id: "buyer-1",
        email: "buyer@example.test",
        profile: {},
      },
      tokens: { access: "access-token", refresh: "refresh-token" },
    } as never);
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>
    );

    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(screen.getByTestId("auth-user").textContent).toBe("buyer@example.test");
    });
    await userEvent.click(screen.getByRole("button", { name: "Expire session" }));

    await waitFor(() => {
      expect(screen.getByTestId("auth-user").textContent).toBe("anonymous");
    });
    expect(localStorage.getItem("ecoloop_access_token")).toBeNull();
  });
});
