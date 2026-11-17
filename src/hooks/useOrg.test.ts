import { describe, expect, it } from "vitest";
import { canEdit, displayNameFor } from "./useOrg";

describe("useOrg helpers", () => {
  it("prefers the profile display name, then the email local part", () => {
    expect(displayNameFor({ display_name: "Kavita Rao", email: "k@x.test" }, "other@x.test")).toBe("Kavita Rao");
    expect(displayNameFor({ display_name: "  ", email: "kavita.rao@x.test" }, undefined)).toBe("kavita.rao");
    expect(displayNameFor(null, "demo@clubmahindra.com")).toBe("demo");
    expect(displayNameFor(null, undefined)).toBe("Signed in");
  });
  it("follows the permission matrix: admins and supervisors edit, agents, analysts and non-members do not", () => {
    expect(canEdit("super_admin")).toBe(true);
    expect(canEdit("org_admin")).toBe(true);
    expect(canEdit("supervisor")).toBe(true);
    expect(canEdit("agent")).toBe(false);
    expect(canEdit("qa_analyst")).toBe(false);
    expect(canEdit(null)).toBe(false);
  });
});
