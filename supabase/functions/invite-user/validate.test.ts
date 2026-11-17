import { describe, expect, it } from "vitest";
import { normaliseEmail, validateInviteRequest } from "./validate";

describe("normaliseEmail", () => {
  it("trims, lower-cases and requires one @ with a domain", () => {
    expect(normaliseEmail("  Asha@Example.COM ")).toBe("asha@example.com");
    for (const bad of ["", "asha", "asha@", "@example.com", "a b@example.com", "asha@example", 42, null, undefined, "a@b.c".padEnd(260, "x")]) {
      expect(normaliseEmail(bad)).toBeNull();
    }
  });
});

describe("validateInviteRequest", () => {
  it("defaults to invite and returns the normalised request", () => {
    expect(validateInviteRequest({ email: "A@b.test", role: "agent" })).toEqual({ ok: true, request: { action: "invite", email: "a@b.test", role: "agent" } });
  });

  it("rejects a missing or malformed email and an unknown role", () => {
    expect(validateInviteRequest({ role: "agent" })).toEqual({ ok: false, error: "A valid email address is required" });
    expect(validateInviteRequest({ email: "x@y.test", role: "admin" }).ok).toBe(false);
    expect(validateInviteRequest({ email: "x@y.test" }).ok).toBe(false);
    expect(validateInviteRequest(null).ok).toBe(false);
  });

  it("validates a revoke by invitation UUID", () => {
    const id = "6f1c2a4e-9b3d-4c5e-8f7a-1b2c3d4e5f60";
    expect(validateInviteRequest({ action: "revoke", invitationId: id })).toEqual({ ok: true, request: { action: "revoke", invitationId: id } });
    expect(validateInviteRequest({ action: "revoke", invitationId: "123" }).ok).toBe(false);
    expect(validateInviteRequest({ action: "revoke" }).ok).toBe(false);
  });

  it("rejects unknown actions", () => {
    expect(validateInviteRequest({ action: "delete", email: "x@y.test" })).toEqual({ ok: false, error: "action must be invite or revoke" });
  });
});
