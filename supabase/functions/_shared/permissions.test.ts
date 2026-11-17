import { describe, expect, it } from "vitest";
import { ROLES as DOMAIN_ROLES, can, canAssignRole as domainCanAssignRole } from "../../../src/domain/roles";
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

  it("agrees with the domain canAssignRole for every actor/target role pair", () => {
    for (const actor of [...DOMAIN_ROLES, null]) {
      for (const target of DOMAIN_ROLES) {
        expect(canAssignRole(actor, target)).toBe(domainCanAssignRole(actor, target));
      }
    }
  });
});
