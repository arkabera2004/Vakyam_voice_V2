import { describe, expect, it, vi } from "vitest";
import { advanceCallSession, createCallSession, describeStartCallError, type RpcClient } from "./callSession";

const fakeClient = (impl: RpcClient["rpc"]): RpcClient => ({ rpc: impl });

describe("describeStartCallError", () => {
  it("maps each start_call() error code to a message safe to show the caller", () => {
    expect(describeStartCallError({ code: "P0003", message: "x" })).toMatch(/organisation yet/);
    expect(describeStartCallError({ code: "42501", message: "x" })).toMatch(/role is not allowed/);
    expect(describeStartCallError({ code: "P0004", message: "x" })).toMatch(/no voice agent configured/);
    expect(describeStartCallError({ code: "P0002", message: "x" })).toMatch(/could not be found/);
  });

  it("falls back to the raw message for an unrecognised code, and a generic message for none", () => {
    expect(describeStartCallError({ code: "23505", message: "duplicate key" })).toBe("duplicate key");
    expect(describeStartCallError(null)).toMatch(/could not be created/);
    expect(describeStartCallError(undefined)).toMatch(/could not be created/);
  });
});

describe("createCallSession", () => {
  it("calls start_call with the given agent id, or null when none is passed", async () => {
    const rpc = vi.fn(async () => ({ data: { id: "c1", agent_id: "a1", agent_version_id: "v1" }, error: null }));
    await createCallSession(fakeClient(rpc));
    expect(rpc).toHaveBeenCalledWith("start_call", { agent: null });
    await createCallSession(fakeClient(rpc), "a2");
    expect(rpc).toHaveBeenCalledWith("start_call", { agent: "a2" });
  });

  it("returns the created call on success", async () => {
    const client = fakeClient(async () => ({ data: { id: "c1", agent_id: "a1", agent_version_id: "v1" }, error: null }));
    expect(await createCallSession(client)).toEqual({ ok: true, call: { callId: "c1", agentId: "a1", agentVersionId: "v1" } });
  });

  it("returns a described error when the RPC fails, without throwing", async () => {
    const client = fakeClient(async () => ({ data: null, error: { code: "P0003", message: "x" } }));
    expect(await createCallSession(client)).toEqual({ ok: false, error: expect.stringMatching(/organisation yet/) });
  });

  it("treats a null row with no error as a failure too", async () => {
    const client = fakeClient(async () => ({ data: null, error: null }));
    const result = await createCallSession(client);
    expect(result.ok).toBe(false);
  });
});

describe("advanceCallSession", () => {
  it("calls advance_call with the call id, next status and an optional reason", async () => {
    const rpc = vi.fn(async () => ({ data: {}, error: null }));
    await advanceCallSession(fakeClient(rpc), "c1", "active");
    expect(rpc).toHaveBeenCalledWith("advance_call", { call: "c1", next_status: "active", reason: null });
    await advanceCallSession(fakeClient(rpc), "c1", "failed", "no mic");
    expect(rpc).toHaveBeenCalledWith("advance_call", { call: "c1", next_status: "failed", reason: "no mic" });
  });

  it("never throws, even when the RPC errors", async () => {
    const client = fakeClient(async () => ({ data: null, error: { message: "already completed" } }));
    await expect(advanceCallSession(client, "c1", "cancelled")).resolves.toBeUndefined();
  });
});
