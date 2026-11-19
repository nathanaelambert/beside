import assert from "node:assert/strict";

const [app, origin] = process.argv.slice(2);
assert.ok(
  ["api", "playground", "mobile"].includes(app),
  "Choose api, playground or mobile.",
);
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
} else if (app === "mobile") {
  const page = await read("/");
  assert.match(page.headers.get("content-type"), /text\/html/);
  const html = await page.text();
  assert.match(html, /<title>Beside<\/title>/);
  const script = html.match(
    /<script src="(\/_expo\/static\/js\/web\/[^"]+\.js)"/,
  )?.[1];
  assert.ok(script, "index.html should load the Expo web bundle");
  const bundle = await (await read(script)).text();
  // A missing EXPO_PUBLIC_BESIDE_API_URL silently falls back to localhost.
  assert.ok(
    bundle.includes("https://beside-api.vercel.app"),
    "the web bundle should call the production API",
  );
  const wasm = await read("/canvaskit.wasm");
  assert.match(wasm.headers.get("content-type"), /application\/wasm/);
  // Deep links rewrite to the app shell.
  assert.match(await (await read("/HomeBase")).text(), /<div id="root">/);
} else {
  const page = await read("/");
  assert.match(page.headers.get("content-type"), /text\/html/);
  assert.match(await page.text(), /Playground.*Beside/);
}
console.log(`${app}: production verification passed.`);
