import assert from "node:assert/strict";

const [app, origin] = process.argv.slice(2);
assert.ok(app === "api" || app === "playground", "Choose api or playground.");
const base = new URL(origin);
assert.equal(base.protocol, "https:");

async function read(path, expectedStatus = 200) {
  const url = new URL(path, base);
  url.searchParams.set(
    "verification",
    process.env.GITHUB_SHA ?? Date.now().toString(),
  );
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  assert.equal(
    response.status,
    expectedStatus,
    `${url.pathname}: unexpected HTTP status`,
  );
  console.log(`${url.pathname}: ${response.status}`);
  return response;
}

if (app === "api") {
  const health = await (await read("/health/ready")).json();
  assert.equal(health.status, "ok");
  assert.equal(health.database, "connected");
  const spec = await (await read("/openapi.json")).json();
  assert.equal(spec.info.title, "Beside API");
  assert.ok(spec.paths["/api/v1/logs"].post);
  const explorer = await (await read("/docs")).text();
  assert.match(explorer, /swagger-ui/);
  for (const file of [
    "swagger-ui.css",
    "swagger-ui-bundle.js",
    "swagger-ui-standalone-preset.js",
  ]) {
    const asset = await read(`/docs/${file}`);
    assert.ok(
      Number(asset.headers.get("content-length")) > 0 ||
        (await asset.text()).length > 0,
    );
  }
  const unauthorized = await read("/api/v1/state", 401);
  assert.equal(unauthorized.headers.get("cache-control"), "no-store");
} else {
  const page = await read("/");
  assert.match(page.headers.get("content-type"), /text\/html/);
  assert.match(await page.text(), /Playground.*Beside/);
}
console.log(`${app}: production verification passed.`);
