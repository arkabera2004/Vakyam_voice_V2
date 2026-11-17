import { describe, expect, it } from "vitest";
import { ROLES as DOMAIN_ROLES, can } from "../../../src/domain/roles";
import { ROLES, canAssignRole, canEdit, canManage, canReview } from "./permissions";

describe("edge-function permissions mirror src/domain/roles.ts", () => {
  it("lists the same roles in the same order", () => {
    expect([...ROLES]).toEqual([...DOMAIN_ROLES]);
  });

  it("agrees with the domain matrix on every tier", () => {
    for (const role of DOMAIN_ROLES) {
      expect(canManage(role)).toBe(can(role, "org.manage"));
      expect(canEdit(role)).toBe(can(role, "agents.edit"));
      expect(canReview(role)).toBe(can(role, "evaluations.review"));
    }
    expect(canManage(null)).toBe(false);
    expect(canReview(undefined)).toBe(false);
  });

  it("only a super_admin can grant super_admin; managers grant the rest; others grant nothing", () => {
    expect(canAssignRole("super_admin", "super_admin")).toBe(true);
    expect(canAssignRole("org_admin", "super_admin")).toBe(false);
    expect(canAssignRole("org_admin", "org_admin")).toBe(true);
    expect(canAssignRole("org_admin", "agent")).toBe(true);
    expect(canAssignRole("supervisor", "agent")).toBe(false);
    expect(canAssignRole("qa_analyst", "agent")).toBe(false);
    expect(canAssignRole(null, "agent")).toBe(false);
  });
});
