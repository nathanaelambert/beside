import assert from "node:assert/strict";
import { it } from "node:test";
import { BesideClient, type GuestSession } from "./index.ts";

it("redeems an invitation without credentials and saves the returned guest token", async () => {
  const session: GuestSession = {
    token: "guest-test-token",
    expiresAt: "2030-01-01T00:00:00.000Z",
    user: {
      id: "guest",
      name: "Juniper",
      email: null,
      color: "blue",
      isGuest: true,
    },
  };
  const input = { name: "Juniper", inviteCode: "fixture-code-for-this-test" };
  const client = new BesideClient(
    "https://api.example.test",
    async (url, init) => {
      const path = new URL(String(url)).pathname;
      const authorization = new Headers(init?.headers).get("Authorization");
      if (path === "/api/v1/auth/guest") {
        assert.equal(authorization, null);
        assert.equal(init?.method, "POST");
        assert.deepEqual(JSON.parse(String(init.body)), input);
        return Response.json(session, { status: 201 });
      }
      assert.equal(path, "/api/v1/auth/me");
      assert.equal(authorization, `Bearer ${session.token}`);
      return Response.json(session.user);
    },
  );
  assert.deepEqual(await client.joinAsGuest(input), session);
  assert.deepEqual(await client.me(), session.user);
});
