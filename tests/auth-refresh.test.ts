// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/django-auth";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("JWT refresh flow", () => {
  it("refreshes an expired access token and retries the original request", async () => {
    localStorage.setItem("ecoloop_access_token", "expired-access");
    localStorage.setItem("ecoloop_refresh_token", "valid-refresh");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access: "new-access", refresh: "rotated-refresh" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await apiFetch("/auth/me/");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh: "valid-refresh" }),
      })
    );
    const retryHeaders = new Headers(fetchMock.mock.calls[2][1]?.headers);
    expect(retryHeaders.get("Authorization")).toBe("Bearer new-access");
    expect(localStorage.getItem("ecoloop_refresh_token")).toBe("rotated-refresh");
  });

  it("does not refresh or clear a valid session after a bad login attempt", async () => {
    localStorage.setItem("ecoloop_access_token", "current-access");
    localStorage.setItem("ecoloop_refresh_token", "current-refresh");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await apiFetch("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email: "wrong@example.test", password: "wrong" }),
    });

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(localStorage.getItem("ecoloop_refresh_token")).toBe("current-refresh");
  });
});
