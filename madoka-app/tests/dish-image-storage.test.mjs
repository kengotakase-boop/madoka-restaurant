import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../src");
const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const objectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const storedPath = `${id}/${objectId}.png`;
const mainPath = `${id}/main`;
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const imageRoute = "app/api/dishes/[id]/image/route.ts";
const statusRoute = "app/api/images/status/route.ts";

// Actual TS modules run with fake configuration and a deny-by-default fetch.
// This test runner never loads .env, connects to Supabase, or changes process.env.
function harness(options = {}) {
  const calls = [];
  const objects = new Map(options.initialObjects ?? []);
  const downloadCache = new Map();
  const logs = [];
  let uploadAttempts = 0;
  let linkAttempts = 0;
  const rows = options.noDish ? [] : (options.dishIds ?? [id]).map((dishId) => ({ id: dishId, image_path: options.imagePath ?? "", name: "LOCAL TEST ONLY", genre: "washoku", cooked_at: "2026-09-24T00:00:00Z" }));
  const env = {
    TAKASE_APPS_SUPABASE_URL: "https://mock.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fake-anon-for-test",
    MADOKA_RESTAURANT_API_SECRET: "fake-rpc-secret-for-test",
    ...(options.unconfigured ? {} : { MADOKA_RESTAURANT_STORAGE_SERVICE_ROLE_KEY: "fake-server-key-for-test" }),
  };
  const fetchMock = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.startsWith("https://mock.invalid/rest/v1/rpc/")) {
      const params = JSON.parse(init.body);
      assert.equal(params.p_secret, env.MADOKA_RESTAURANT_API_SECRET);
      if (url.endsWith("madoka_restaurant_get_dish")) {
        if (options.rpcError) return Response.json({ message: "private-upstream-detail" }, { status: 500 });
        return Response.json(rows.filter((row) => row.id.toLowerCase() === params.p_id.toLowerCase()));
      }
      if (url.endsWith("madoka_restaurant_list_dishes")) return Response.json(rows);
      if (url.endsWith("madoka_restaurant_create_dish")) return Response.json(id);
      if (url.endsWith("madoka_restaurant_update_dish")) return new Response(null, { status: 204 });
      if (url.endsWith("madoka_restaurant_update_dish_image")) {
        linkAttempts++;
        if (options.linkFailure || linkAttempts <= (options.linkFailures ?? 0)) return Response.json({ message: "private-upstream-detail" }, { status: 500 });
        const row = rows.find((row) => row.id.toLowerCase() === params.p_id.toLowerCase());
        if (!options.noLink && row) row.image_path = params.p_image_path;
        // The database committed, but the server never receives its response.
        if (linkAttempts <= (options.linkResponseLosses ?? 0)) throw new Error("mock response lost after DB commit");
        return new Response(null, { status: 204 });
      }
    }
    if (url.startsWith("https://mock.invalid/storage/v1/")) {
      assert.equal(init.headers.Authorization, `Bearer ${env.MADOKA_RESTAURANT_STORAGE_SERVICE_ROLE_KEY}`);
      assert.equal(init.redirect, "error");
      if (options.networkFailure) throw new Error("private-upstream-detail");
      if (url.endsWith("bucket/madoka-restaurant-images")) {
        if (options.noBucket) return new Response(null, { status: 404 });
        return Response.json({ id: "madoka-restaurant-images", public: options.publicBucket ?? false });
      }
      if (url.includes("/object/authenticated/madoka-restaurant-images/")) {
        const object = objects.get(new URL(url).pathname.split("/object/authenticated/madoka-restaurant-images/")[1]);
        if (options.cdnCache) {
          // Simulate propagation delay: cache headers alone do not evict a URL.
          if (!downloadCache.has(url)) downloadCache.set(url, { bytes: new Uint8Array(object.bytes), type: object.type });
          const cached = downloadCache.get(url);
          return new Response(cached.bytes, { headers: { "Content-Type": cached.type } });
        }
        return new Response(options.downloadBytes ?? object?.bytes ?? png, { status: options.downloadStatus ?? 200, headers: { "Content-Type": options.downloadType ?? object?.type ?? "image/png" } });
      }
      if (url.includes("/object/madoka-restaurant-images/") && init.method === "POST") {
        uploadAttempts++;
        assert.equal(init.headers["x-upsert"], "true");
        assert.equal(init.headers["Cache-Control"], "max-age=0");
        if (!options.uploadFailure) {
          objects.set(url.split("/object/madoka-restaurant-images/")[1], {
            bytes: new Uint8Array(await init.body.arrayBuffer()), type: init.headers["Content-Type"],
          });
          // Storage committed, but the server cannot know whether it succeeded.
          if (uploadAttempts <= (options.uploadResponseLosses ?? 0)) throw new Error("mock response lost after upload");
        }
        return Response.json({}, { status: options.uploadFailure ? 500 : 200 });
      }
    }
    throw new Error(`Unexpected MOCK request: ${url}`);
  };
  const cache = new Map();
  const load = (relative) => {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const requireModule = (specifier) => {
      if (specifier === "server-only") return {};
      if (specifier === "next/server") return { NextResponse: Response };
      if (specifier.startsWith("node:")) return nativeRequire(specifier);
      if (specifier === "@/config/features" && options.disabled) return { IMAGES_ENABLED: false };
      const target = specifier.startsWith("@/") ? path.resolve(root, specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
      return load(path.relative(root, `${target}.ts`));
    };
    const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const context = vm.createContext({
      module: loadedModule, exports: loadedModule.exports, require: requireModule, process: { env },
      fetch: fetchMock, Request, Response, Blob, Uint8Array, AbortSignal, URL,
      console: { error(...args) { logs.push(args); }, warn(...args) { logs.push(args); } }, ...options.globals,
    });
    vm.runInContext(compiled, context, { filename });
    return loadedModule.exports;
  };
  return { load, calls, rows, objects, logs };
}

function uploadRequest({ type = "image/png", bytes = png, origin = "http://localhost:3000", header = "1", dishId = id } = {}) {
  return new Request(`http://localhost:3000/api/dishes/${dishId}/image`, {
    method: "POST", headers: { "Content-Type": type, Origin: origin, "X-Madoka-Image-Upload": header }, body: bytes,
  });
}
const context = (dishId = id) => ({ params: Promise.resolve({ id: dishId }) });
const uploads = (h) => h.calls.filter((c) => c.url.includes("/object/madoka-restaurant-images/"));
const links = (h) => h.calls.filter((c) => c.url.endsWith("madoka_restaurant_update_dish_image"));

test("upload then link/readback, fixed dish-scoped path, same-origin private GET", async () => {
  const h = harness();
  const route = h.load(imageRoute);
  const first = await route.POST(uploadRequest(), context());
  assert.equal(first.status, 200);
  const firstResult = await first.json();
  assert.ok(firstResult.imagePath.startsWith(`${id}/`));
  assert.ok(h.load("lib/imageRules.ts").parseDishImagePath(firstResult.imagePath));
  const second = await route.POST(uploadRequest(), context());
  assert.equal((await second.json()).imagePath, firstResult.imagePath);
  assert.equal(firstResult.imagePath, mainPath);
  assert.equal(h.objects.size, 1);
  const uploadIndex = h.calls.findIndex((c) => c.url.includes("/object/madoka-restaurant-images/"));
  const linkIndex = h.calls.findIndex((c) => c.url.endsWith("madoka_restaurant_update_dish_image"));
  assert.ok(uploadIndex < linkIndex);
  const response = await route.GET(new Request("http://localhost:3000"), context());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), png);
});

for (const [name, options, request, expected] of [
  ["missing server key", { unconfigured: true }, {}, 503],
  ["missing bucket", { noBucket: true }, {}, 503],
  ["public bucket", { publicBucket: true }, {}, 503],
  ["network failure", { networkFailure: true }, {}, 503],
  ["missing dish", { noDish: true }, {}, 404],
  ["RPC failure", { rpcError: true }, {}, 502],
  ["feature disabled", { disabled: true }, {}, 503],
  ["cross-origin", {}, { origin: "https://attacker.invalid" }, 403],
  ["missing CSRF header", {}, { header: "" }, 403],
  ["unsupported MIME", {}, { type: "image/svg+xml" }, 415],
  ["bad signature", {}, { bytes: new Uint8Array([1, 2, 3]) }, 415],
  ["empty file", {}, { bytes: new Uint8Array() }, 400],
  ["oversize without Content-Length", {}, { bytes: new Uint8Array(4 * 1024 * 1024 + 1) }, 413],
]) {
  test(`${name}: no upload or image link`, async () => {
    const h = harness(options);
    const response = await h.load(imageRoute).POST(uploadRequest(request), context());
    assert.equal(response.status, expected);
    assert.equal(uploads(h).length, 0);
    assert.equal(links(h).length, 0);
    assert.equal((await response.text()).includes("private-upstream-detail"), false);
  });
}

for (const options of [{ uploadFailure: true }, { linkFailure: true }, { noLink: true }]) {
  test(`failure preserves dish and old linked image: ${JSON.stringify(options)}`, async () => {
    const h = harness({ ...options, imagePath: storedPath });
    const response = await h.load(imageRoute).POST(uploadRequest(), context());
    assert.equal(response.status, 502);
    assert.equal(h.rows.length, 1);
    assert.equal(h.rows[0].image_path, storedPath);
    assert.equal(h.calls.some((c) => c.init.method === "DELETE" || c.url.includes("delete_dish")), false);
    assert.equal((await response.text()).includes("private-upstream-detail"), false);
  });
}

for (const imagePath of ["", "https://other.invalid/photo.jpg", "../secret.png", `${otherId}/${objectId}.png`]) {
  test(`GET refuses an unbound/legacy path: ${imagePath}`, async () => {
    const h = harness({ imagePath });
    const response = await h.load(imageRoute).GET(new Request("http://localhost:3000"), context());
    assert.equal(response.status, 404);
    assert.equal(h.calls.some((c) => c.url.includes("/storage/")), false);
  });
}

for (const [options, status] of [
  [{ unconfigured: true }, 503], [{ publicBucket: true }, 503],
  [{ downloadStatus: 404 }, 404], [{ downloadType: "text/html" }, 502],
  [{ downloadBytes: new Uint8Array([1, 2, 3]) }, 502],
  [{ downloadBytes: new Uint8Array(4 * 1024 * 1024 + 1) }, 413],
]) {
  test(`GET safely fails: ${Object.keys(options)[0]}`, async () => {
    const h = harness({ imagePath: storedPath, ...options });
    const response = await h.load(imageRoute).GET(new Request("http://localhost:3000"), context());
    assert.equal(response.status, status);
  });
}

test("invalid dish ID never reaches RPC or Storage", async () => {
  const h = harness();
  assert.equal((await h.load(imageRoute).POST(uploadRequest(), context("../bad"))).status, 400);
  assert.equal(h.calls.length, 0);
});

test("status fail-closed and existing dish creation/list work without Storage", async () => {
  const h = harness({ unconfigured: true });
  assert.deepEqual(await (await h.load(statusRoute).GET()).json(), { available: false });
  assert.equal(h.calls.length, 0);
  const routes = h.load("app/api/dishes/route.ts");
  const create = await routes.POST(new Request("http://localhost:3000/api/dishes", {
    method: "POST", body: JSON.stringify({ name: "LOCAL TEST ONLY" }),
  }));
  assert.equal(create.status, 200);
  assert.deepEqual(await create.json(), { id });
  assert.equal((await routes.GET()).status, 200);
  assert.equal(h.calls.some((c) => c.url.includes("/storage/")), false);
});

test("status available only for the configured private bucket", async () => {
  for (const options of [{}, { noBucket: true }, { publicBucket: true }, { disabled: true }]) {
    const h = harness(options);
    const response = await h.load(statusRoute).GET();
    assert.equal((await response.json()).available, Object.keys(options).length === 0);
  }
});

test("shared file validation: exact 10MiB accepted, larger/SVG/empty rejected; safe URLs only", () => {
  const h = harness();
  const rules = h.load("lib/imageRules.ts");
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(rules.imageFileError({ type, size: 10 * 1024 * 1024 }), null);
  }
  assert.ok(rules.imageFileError({ type: "image/png", size: 10 * 1024 * 1024 + 1 }));
  assert.ok(rules.imageFileError({ type: "image/png", size: 0 }));
  assert.ok(rules.imageFileError({ type: "image/svg+xml", size: 100 }));
  const client = h.load("lib/storage.ts");
  assert.equal(client.getDishImageUrl(storedPath), `/api/dishes/${id}/image?v=${objectId}`);
  assert.equal(client.getDishImageUrl("https://external.invalid/image.png"), null);
});

test("JPEG and WebP signatures are accepted; MIME spoofing is rejected", async () => {
  for (const [type, bytes] of [
    ["image/jpeg", new Uint8Array([255, 216, 255, 224])],
    ["image/webp", new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80])],
  ]) {
    const h = harness();
    assert.equal((await h.load(imageRoute).POST(uploadRequest({ type, bytes }), context())).status, 200);
    assert.equal((await h.load(imageRoute).POST(uploadRequest({ type, bytes: png }), context())).status, 415);
  }
});

test("client re-encodes and resizes, sends only encoded bytes to attachment API", async () => {
  let closed = false;
  let sent = null;
  const encoded = new Blob([png], { type: "image/png" });
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toBlob: (callback) => callback(encoded) };
  const h = harness({ globals: {
    document: { createElement: () => canvas },
    createImageBitmap: async () => ({ width: 4000, height: 3000, close() { closed = true; } }),
    fetch: async (url, init) => { sent = { url, init }; return Response.json({ imagePath: storedPath }); },
  } });
  assert.equal(await h.load("lib/storage.ts").uploadDishImage({ size: 1000, type: "image/png" }, id), storedPath);
  assert.equal(canvas.width, 2048);
  assert.equal(canvas.height, 1536);
  assert.equal(sent.init.body, encoded);
  assert.equal(sent.url, `/api/dishes/${id}/image`);
  assert.equal(closed, true);
});

test("SQL restricts this bucket only and never alters dish schema or grants browser access", () => {
  const sql = readFileSync(path.resolve(root, "../docs/sql/madoka-restaurant-images.sql"), "utf8");
  assert.match(sql, /as restrictive\s+for all\s+to anon, authenticated/);
  assert.match(sql, /on conflict \(id\) do nothing/);
  assert.match(sql, /bucket_id <> 'madoka-restaurant-images'/);
  assert.match(sql, /pg_catalog\.pg_policies/);
  assert.match(sql, /permissive = 'RESTRICTIVE' and cmd = 'ALL'/);
  assert.match(sql, /and with_check =/);
  assert.match(sql, /and relrowsecurity/);
  assert.match(sql, /Existing madoka_images_server_only policy differs/);
  assert.doesNotMatch(sql, /alter table|create table|grant |drop policy|update storage\.buckets/i);
});

test("untrusted dish IDs and stored paths cannot reach Storage", async () => {
  for (const invalidId of ["../wine-labels", "https://other.invalid", `${id}/..`, `${id}%2f..`, `${id}\n`, `${id}\0`, "-".repeat(36)]) {
    const h = harness();
    const route = h.load(imageRoute);
    assert.equal((await route.POST(uploadRequest(), context(invalidId))).status, 400);
    assert.equal((await route.GET(new Request("http://localhost:3000"), context(invalidId))).status, 400);
    assert.equal(h.calls.length, 0);
  }
  for (const invalidPath of [
    `wine-labels/${storedPath}`, `body-canvas-photos/${storedPath}`,
    `${id}/../../wine-labels/${objectId}.png`, `${id}/%2e%2e%2fwine-labels.png`,
    `${id}\\${objectId}.png`, `//other.invalid/${storedPath}`,
    `${storedPath}?bucket=wine-labels`, `${storedPath}#suffix`, `${storedPath}\n`,
    `${id}/${objectId}.svg`, `${id}/${"-".repeat(36)}.png`,
  ]) {
    const h = harness({ imagePath: invalidPath });
    const response = await h.load(imageRoute).GET(new Request("http://localhost:3000"), context());
    assert.equal(response.status, 404, invalidPath);
    assert.equal(h.calls.some((c) => c.url.includes("/storage/")), false);
  }
});

test("bucket/path query parameters cannot redirect GET or POST Storage operations", async () => {
  const h = harness({ imagePath: storedPath });
  const url = `http://localhost:3000/api/dishes/${id}/image?bucket=wine-labels&path=../../body-canvas-photos/private.jpg`;
  const route = h.load(imageRoute);
  assert.equal((await route.GET(new Request(url), context())).status, 200);
  assert.equal((await route.POST(new Request(url, uploadRequest()), context())).status, 200);
  for (const call of h.calls.filter((c) => c.url.includes("/storage/"))) {
    assert.match(call.url, /^https:\/\/mock\.invalid\/storage\/v1\/(bucket|object|object\/authenticated)\/madoka-restaurant-images(?:\/|$)/);
    assert.equal(call.url.includes("wine-labels"), false);
    assert.equal(call.url.includes("body-canvas-photos"), false);
  }
});

test("image API success/failure responses and captured logs never contain server credentials", async () => {
  for (const options of [{}, { uploadFailure: true }, { linkFailure: true }, { rpcError: true }, { networkFailure: true }]) {
    const h = harness({ imagePath: storedPath, ...options });
    const route = h.load(imageRoute);
    const post = await route.POST(uploadRequest(), context());
    const get = await route.GET(new Request("http://localhost:3000"), context());
    const output = JSON.stringify([await post.text(), await get.text(), [...post.headers], [...get.headers], h.logs]);
    for (const forbidden of ["fake-server-key-for-test", "fake-rpc-secret-for-test", "private-upstream-detail"]) {
      assert.equal(output.includes(forbidden), false);
    }
  }
});

test("dish detail/edit routes remain independent of missing Storage and preserve image omission", async () => {
  const h = harness({ unconfigured: true });
  const route = h.load("app/api/dishes/[id]/route.ts");
  const response = await route.GET(new Request("http://localhost:3000"), context());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).imagePath, "");
  const update = await route.PATCH(new Request("http://localhost:3000", { method: "PATCH", body: JSON.stringify({ name: "LOCAL TEST ONLY" }) }), context());
  assert.equal(update.status, 200);
  const rpcCall = h.calls.find((c) => c.url.endsWith("madoka_restaurant_update_dish"));
  assert.equal(JSON.parse(rpcCall.init.body).p_image_path, null);
  assert.equal(h.calls.some((c) => c.url.includes("/storage/")), false);
});

test("regression: repeated link failures retain at most one new unlinked object", async () => {
  const h = harness({ linkFailure: true, imagePath: storedPath });
  for (let attempt = 0; attempt < 3; attempt++) {
    assert.equal((await h.load(imageRoute).POST(uploadRequest(), context())).status, 502);
  }
  assert.equal(h.rows[0].image_path, storedPath);
  assert.equal(h.objects.size, 1);
  assert.deepEqual([...h.objects.keys()], [mainPath]);
});

test("same dish retried three times has exactly one object and one linked path", async () => {
  const h = harness();
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await h.load(imageRoute).POST(uploadRequest(), context());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).imagePath, mainPath);
    assert.equal(h.objects.size, 1);
  }
  assert.equal(uploads(h).length, 3);
  assert.equal(h.rows[0].image_path, mainPath);
});

test("upload succeeds, DB link fails twice, retry links the single existing object", async () => {
  const h = harness({ linkFailures: 2 });
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await h.load(imageRoute).POST(uploadRequest(), context());
    assert.equal(response.status, attempt < 2 ? 502 : 200);
    assert.equal(h.objects.size, 1);
    assert.equal(h.rows.length, 1);
  }
  assert.equal(h.rows[0].image_path, mainPath);
  assert.equal(h.calls.some((c) => c.init.method === "DELETE"), false);
});

test("DB commits then its response is lost: retry keeps one object and link", async () => {
  const h = harness({ linkResponseLosses: 1 });
  const route = h.load(imageRoute);
  assert.equal((await route.POST(uploadRequest(), context())).status, 502);
  assert.equal(h.rows[0].image_path, mainPath);
  assert.equal(h.objects.size, 1);
  assert.equal((await route.POST(uploadRequest(), context())).status, 200);
  assert.equal(h.objects.size, 1);
  assert.equal(h.rows[0].image_path, mainPath);
  assert.equal(h.calls.some((c) => c.init.method === "DELETE"), false);
});

test("Storage commits then upload response is lost: retry reuses and links the same object", async () => {
  const h = harness({ uploadResponseLosses: 1 });
  const route = h.load(imageRoute);
  assert.equal((await route.POST(uploadRequest(), context())).status, 503);
  assert.equal(h.objects.size, 1);
  assert.equal(h.rows[0].image_path, "");
  assert.equal(links(h).length, 0);
  assert.equal((await route.POST(uploadRequest(), context())).status, 200);
  assert.equal(h.objects.size, 1);
  assert.equal(h.rows[0].image_path, mainPath);
  assert.equal(h.calls.some((c) => c.init.method === "DELETE"), false);
});

test("final application response lost after DB commit: client retry is idempotent", async () => {
  const h = harness();
  const route = h.load(imageRoute);
  // Discard the first completed response, as if it never reached the browser.
  await route.POST(uploadRequest(), context());
  const retry = await route.POST(uploadRequest(), context());
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).imagePath, mainPath);
  assert.equal(h.objects.size, 1);
  assert.equal(h.rows[0].image_path, mainPath);
});

test("separate dishes cannot overwrite one another even with forged DB path/query fields", async () => {
  const h = harness({ dishIds: [id, otherId] });
  const route = h.load(imageRoute);
  const otherBytes = new Uint8Array([...png, 99]);
  assert.equal((await route.POST(uploadRequest({ dishId: otherId, bytes: otherBytes }), context(otherId))).status, 200);
  h.rows[0].image_path = `${otherId}/main`;
  assert.equal((await route.GET(new Request("http://localhost:3000"), context())).status, 404);
  const forged = new Request(`http://localhost:3000/api/dishes/${id}/image?path=${otherId}/main&bucket=wine-labels`, uploadRequest());
  assert.equal((await route.POST(forged, context())).status, 200);
  assert.equal(h.objects.size, 2);
  assert.deepEqual(h.objects.get(`${otherId}/main`).bytes, otherBytes);
  assert.deepEqual(h.objects.get(mainPath).bytes, png);
  assert.equal(h.rows[0].image_path, mainPath);
  assert.equal(h.rows[1].image_path, `${otherId}/main`);
});

test("extensionless main preserves Content-Type across JPEG/PNG/WebP replacement", async () => {
  const h = harness();
  const route = h.load(imageRoute);
  for (const [type, bytes] of [
    ["image/jpeg", new Uint8Array([255, 216, 255, 224])],
    ["image/png", png],
    ["image/webp", new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80])],
  ]) {
    assert.equal((await route.POST(uploadRequest({ type, bytes }), context())).status, 200);
    assert.equal(h.objects.size, 1);
    assert.equal(h.objects.get(mainPath).type, type);
    const download = await route.GET(new Request("http://localhost:3000"), context());
    assert.equal(download.status, 200);
    assert.equal(download.headers.get("content-type"), type);
    assert.deepEqual(new Uint8Array(await download.arrayBuffer()), bytes);
  }
  assert.equal(h.load("lib/storage.ts").getDishImageUrl(mainPath), `/api/dishes/${id}/image?v=main`);
});

test("legacy UUID object remains readable and is never overwritten or deleted", async () => {
  const legacy = { bytes: new Uint8Array([...png, 42]), type: "image/png" };
  const h = harness({ imagePath: storedPath, initialObjects: [[storedPath, legacy]] });
  const route = h.load(imageRoute);
  const before = await route.GET(new Request("http://localhost:3000"), context());
  assert.equal(before.status, 200);
  assert.deepEqual(new Uint8Array(await before.arrayBuffer()), legacy.bytes);
  for (let attempt = 0; attempt < 3; attempt++) {
    assert.equal((await route.POST(uploadRequest(), context())).status, 200);
    // One pre-existing legacy object plus exactly one new canonical object.
    assert.equal(h.objects.size, 2);
    assert.equal(h.objects.get(storedPath), legacy);
  }
  assert.equal(h.rows[0].image_path, mainPath);
  assert.equal(h.calls.some((c) => c.init.method === "DELETE"), false);
  // Existing records still referencing the old path remain readable.
  h.rows[0].image_path = storedPath;
  assert.equal((await route.GET(new Request("http://localhost:3000"), context())).status, 200);
});

test("mixed UUID case and concurrent requests still use one canonical object", async () => {
  const mixedId = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
  const h = harness({ dishIds: [mixedId] });
  const route = h.load(imageRoute);
  const responses = await Promise.all([mixedId, mixedId.toUpperCase(), mixedId].map((dishId) =>
    route.POST(uploadRequest({ dishId }), context(dishId))));
  assert.ok(responses.every((response) => response.status === 200));
  assert.equal(h.objects.size, 1);
  assert.deepEqual([...h.objects.keys()], [`${mixedId}/main`]);
});

test("Storage helpers independently reject paths/IDs outside their closed grammar", async () => {
  const h = harness();
  const storage = h.load("app/api/_dishImageStorage.ts");
  for (const invalidId of [`${id}/main`, "../wine-labels", `${id}%2f..`, `${id}\n`]) {
    await assert.rejects(storage.putDishImage(invalidId, png, "image/png"));
  }
  for (const invalidPath of [`${mainPath}/..`, `${mainPath}?bucket=wine-labels`, `${id}/main.png`, `wine-labels/${mainPath}`, `${mainPath}\n`]) {
    await assert.rejects(storage.fetchDishImage(invalidPath));
  }
  assert.equal(h.calls.length, 0);
});

test("fixed-path replacement bypasses stale CDN without creating another object", async () => {
  const h = harness({ cdnCache: true });
  const route = h.load(imageRoute);
  const replaced = new Uint8Array([...png, 42]);
  for (const bytes of [png, replaced]) {
    assert.equal((await route.POST(uploadRequest({ bytes }), context())).status, 200);
    const response = await route.GET(new Request("http://localhost:3000"), context());
    assert.equal(response.status, 200);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  }
  const downloads = h.calls.filter(c => c.url.includes("/object/authenticated/")).map(c => new URL(c.url));
  assert.equal(downloads.length, 2);
  assert.equal(downloads[0].pathname, downloads[1].pathname);
  assert.ok(downloads.every(u => /^[0-9a-f-]{36}$/.test(u.searchParams.get("cacheNonce"))));
  assert.notEqual(downloads[0].search, downloads[1].search);
  assert.equal(h.objects.size, 1);
  assert.equal(h.rows[0].image_path, mainPath);
});
