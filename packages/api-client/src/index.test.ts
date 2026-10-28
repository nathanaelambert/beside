import { it } from "node:test";
import assert from "node:assert/strict";
import { ApiError, BesideClient } from "./index.ts";

it("calls browser fetch with the global receiver", async () => {
  const client = new BesideClient("https://api.example.test", function (
    this: typeof globalThis,
  ) {
    assert.equal(this, globalThis);
    return Promise.resolve(Response.json({}));
  } as typeof fetch);
  await client.state();
});

it("uses bearer authorization, preserves idempotency keys, and encodes identifiers", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const client = new BesideClient("https://api.example.test/", (async (
    url,
    init,
  ) => {
    requests.push({ url: String(url), init });
    return Response.json({ entityId: "log_1", duplicate: false });
  }) as typeof fetch);
  client.setToken("session-token");
  await client.shareLog("log/1", ["homebase_1"]);
  assert.equal(
    requests[0]!.url,
    "https://api.example.test/api/v1/logs/log%2F1/shares",
  );
  assert.equal(
    new Headers(requests[0]!.init?.headers).get("Authorization"),
    "Bearer session-token",
  );
  await client.recordLog({
    milestoneId: "m1",
    isSuccess: true,
    title: "Done",
    durationMinutes: 0,
    occurredAt: "2026-01-01T00:00:00.000Z",
    origin: "manual",
    externalKey: "retry-key",
  });
  assert.equal(
    JSON.parse(String(requests[1]!.init?.body)).externalKey,
    "retry-key",
  );
});
it("returns validation errors and supports an empty logout response", async () => {
  const client = new BesideClient("https://api.example.test", (async () =>
    Response.json(
      {
        message: "Invalid milestone",
        issues: [{ path: "milestoneId", message: "Required" }],
      },
      { status: 400 },
    )) as typeof fetch);
  await assert.rejects(
    client.state(),
    (error) =>
      error instanceof ApiError &&
      error.status === 400 &&
      error.issues?.[0]?.path === "milestoneId",
  );
  const logout = new BesideClient(
    "https://api.example.test",
    (async () => new Response(null, { status: 204 })) as typeof fetch,
  );
  await assert.doesNotReject(() => logout.logout());
});
