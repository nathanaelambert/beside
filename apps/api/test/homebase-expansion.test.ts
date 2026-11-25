import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import type { ApiHomebase, Session } from "@beside/domain/api";
import { homeExpansionCandidates } from "@beside/domain/homebase-expansion";
import request from "supertest";
import { createApp } from "../src/application.ts";

it("registers a bearer-only, single-tile expansion contract", async () => {
  const app = await createApp(false);
  try {
    await app.init();
    const api = request(app.getHttpServer());
    const { body } = await api.get("/openapi.json").expect(200);
    const definition = body.paths["/api/v1/homebases/{homebaseId}/expansion"];
    assert.ok(definition.get.security?.[0].bearer);
    assert.ok(definition.put.security?.[0].bearer);
    assert.equal(
      definition.put.requestBody.content["application/json"].schema
        .additionalProperties,
      false,
    );
    await api.get("/api/v1/homebases/any/expansion").expect(401);
    await api
      .put("/api/v1/homebases/any/expansion")
      .send({ col: 10, row: 15 })
      .expect(401);
  } finally {
    await app.close();
  }
});

it(
  "persists exactly one eligible connected tile per command across sessions without changing the old meadow",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const app = await createApp(false);
    try {
      await app.init();
      const api = request(app.getHttpServer());
      const signUp = async (
        name: string,
        inviteCode?: string,
      ): Promise<Session> => {
        const response = await api
          .post("/api/v1/auth/register")
          .send({
            name,
            email: `${randomUUID()}@example.test`,
            password: "only-for-the-local-expansion-test",
            ...(inviteCode ? { inviteCode } : {}),
          })
          .expect(201);
        return response.body;
      };
      const host = await signUp("Coast host");
      const auth = ({ token }: Session) => `Bearer ${token}`;
      const { body: bases } = await api
        .get("/api/v1/homebases")
        .set("Authorization", auth(host))
        .expect(200);
      const base: ApiHomebase = bases[0]!;
      assert.ok(base.inviteCode);
      const member = await signUp("Coast resident", base.inviteCode);
      const outsider = await signUp("Coast outsider");
      const home = `/api/v1/homebases/${base.id}`;
      const get = (session: Session) =>
        api.get(`${home}/expansion`).set("Authorization", auth(session));
      const add = (session: Session, tile: object) =>
        api
          .put(`${home}/expansion`)
          .set("Authorization", auth(session))
          .send(tile);
      await get(host).expect(200, { additions: [] });
      await get(member).expect(200, { additions: [] });

      const { body: gardenBefore } = await api
        .post(`${home}/garden/starter-oak`)
        .set("Authorization", auth(host))
        .send({ x: 104, y: 104 })
        .expect(200);
      const [tile, next] = homeExpansionCandidates([]);
      assert.ok(tile && next);
      await get(outsider).expect(404);
      await add(outsider, tile).expect(404);
      for (const invalid of [
        { col: 10, row: 14 }, // Existing land
        { col: 18, row: 8 }, // East mooring
        { col: 10, row: 16 }, // Detached
        { col: 10.5, row: 15 },
        { col: "10", row: 15 },
        { col: -1, row: 15 },
        { ...tile, another: next },
        [tile, next],
      ])
        await add(host, invalid).expect(400);
      await get(host).expect(200, { additions: [] });

      // The connection-specific primary key makes two concurrent confirmations a single cell.
      await Promise.all(
        [host, member].map((session) =>
          add(session, tile).expect(200, { additions: [tile] }),
        ),
      );
      await get(member).expect(200, { additions: [tile] });
      await add(member, next).expect(200, { additions: [tile, next] });
      await add(host, tile).expect(200, { additions: [tile, next] });
      await get(host).expect(200, { additions: [tile, next] });
      await api
        .get(`${home}/garden`)
        .set("Authorization", auth(member))
        .expect(200, gardenBefore);
      const { body: outsiderBases } = await api
        .get("/api/v1/homebases")
        .set("Authorization", auth(outsider))
        .expect(200);
      await api
        .get(`/api/v1/homebases/${outsiderBases[0].id}/expansion`)
        .set("Authorization", auth(outsider))
        .expect(200, { additions: [] });
    } finally {
      await app.close();
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
    }
  },
);
