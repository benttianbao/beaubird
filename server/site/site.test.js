const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { test } = require("node:test");

const { createSiteServer } = require("./app");
const { createUser, initializeSiteDatabase } = require("./store");

function createTempDatabase() {
  const dir = mkdtempSync(join(tmpdir(), "beaubird-site-"));
  return {
    dir,
    databasePath: join(dir, "site.sqlite"),
    cleanup() {
      rmSync(dir, { force: true, recursive: true });
    }
  };
}

async function withServer(options, run) {
  const server = createSiteServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await run({
      baseUrl,
      async request(path, init = {}) {
        return fetch(`${baseUrl}${path}`, { redirect: "manual", ...init });
      }
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (typeof options.database?.close === "function") {
      options.database.close();
    }
    if (typeof options.close === "function") {
      options.close();
    }
  }
}

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";")[0] || "";
}

async function json(response) {
  return JSON.parse(await response.text());
}

test("requires login before serving the BeauBird frontend", async () => {
  const temp = createTempDatabase();
  try {
    const db = initializeSiteDatabase(temp.databasePath);
    await withServer({ database: db, projectRoot: process.cwd() }, async ({ request }) => {
      const home = await request("/");
      assert.equal(home.status, 302);
      assert.equal(home.headers.get("location"), "/login");

      const health = await request("/site/health");
      assert.equal(health.status, 200);
      assert.deepEqual(await json(health), { ok: true, service: "beaubird-site" });
    });
  } finally {
    temp.cleanup();
  }
});

test("admin creates a user whose temporary password must be changed on first login", async () => {
  const temp = createTempDatabase();
  try {
    const db = initializeSiteDatabase(temp.databasePath);
    createUser(db, {
      username: "admin",
      password: "AdminPass123!",
      role: "admin",
      mustChangePassword: false
    });

    await withServer({ database: db, projectRoot: process.cwd() }, async ({ request }) => {
      const login = await request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "AdminPass123!" })
      });
      assert.equal(login.status, 200);
      const adminCookie = cookieFrom(login);
      const csrf = (await json(login)).csrfToken;
      assert.match(adminCookie, /^bb_session=/);
      assert.equal(typeof csrf, "string");

      const created = await request("/api/admin/users", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: adminCookie,
          "x-csrf-token": csrf
        },
        body: JSON.stringify({ username: "birder", role: "user" })
      });
      assert.equal(created.status, 201);
      const createdBody = await json(created);
      assert.equal(createdBody.user.username, "birder");
      assert.equal(createdBody.user.role, "user");
      assert.equal(createdBody.temporaryPassword, "123456");

      const userLogin = await request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "birder", password: createdBody.temporaryPassword })
      });
      assert.equal(userLogin.status, 200);
      const userLoginBody = await json(userLogin);
      const userCookie = cookieFrom(userLogin);
      assert.equal(userLoginBody.mustChangePassword, true);

      const blockedHome = await request("/", { headers: { cookie: userCookie } });
      assert.equal(blockedHome.status, 302);
      assert.equal(blockedHome.headers.get("location"), "/change-password");

      const mismatch = await request("/api/auth/change-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: userCookie,
          "x-csrf-token": userLoginBody.csrfToken
        },
        body: JSON.stringify({ newPassword: "NewPass123!", confirmPassword: "Different123!" })
      });
      assert.equal(mismatch.status, 400);
      assert.equal((await json(mismatch)).error, "两次输入的新密码不一致。");

      const changed = await request("/api/auth/change-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: userCookie,
          "x-csrf-token": userLoginBody.csrfToken
        },
        body: JSON.stringify({ newPassword: "NewPass123!", confirmPassword: "NewPass123!" })
      });
      assert.equal(changed.status, 200);

      const home = await request("/", { headers: { cookie: userCookie } });
      assert.equal(home.status, 200);
      assert.match(await home.text(), /BeauBird/);

      const admin = await request("/admin", { headers: { cookie: userCookie } });
      assert.equal(admin.status, 403);
    });
  } finally {
    temp.cleanup();
  }
});

test("returns a clear validation error when a new password is too weak", async () => {
  const temp = createTempDatabase();
  try {
    const db = initializeSiteDatabase(temp.databasePath);
    createUser(db, {
      username: "admin",
      password: "AdminPass123!",
      role: "admin",
      mustChangePassword: false
    });

    await withServer({ database: db, projectRoot: process.cwd() }, async ({ request }) => {
      const login = await request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "AdminPass123!" })
      });
      const adminCookie = cookieFrom(login);
      const csrf = (await json(login)).csrfToken;

      const changed = await request("/api/auth/change-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: adminCookie,
          "x-csrf-token": csrf
        },
        body: JSON.stringify({ currentPassword: "AdminPass123!", newPassword: "123456", confirmPassword: "123456" })
      });
      assert.equal(changed.status, 400);
      assert.equal((await json(changed)).error, "密码需为 10-128 位，并且同时包含英文字母和数字。");
    });
  } finally {
    temp.cleanup();
  }
});

test("locks login attempts after repeated failures for the same username and ip", async () => {
  const temp = createTempDatabase();
  try {
    const db = initializeSiteDatabase(temp.databasePath);
    createUser(db, {
      username: "admin",
      password: "AdminPass123!",
      role: "admin",
      mustChangePassword: false
    });

    await withServer(
      {
        database: db,
        projectRoot: process.cwd(),
        security: { maxLoginFailures: 2, lockoutMs: 60_000 }
      },
      async ({ request }) => {
        for (let index = 0; index < 2; index += 1) {
          const failed = await request("/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "wrong-password" })
          });
          assert.equal(failed.status, 401);
        }

        const locked = await request("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: "admin", password: "AdminPass123!" })
        });
        assert.equal(locked.status, 429);
        assert.equal((await json(locked)).error, "登录尝试过多，请稍后再试。");
      }
    );
  } finally {
    temp.cleanup();
  }
});

test("admin can reset and disable users", async () => {
  const temp = createTempDatabase();
  try {
    const db = initializeSiteDatabase(temp.databasePath);
    createUser(db, {
      username: "admin",
      password: "AdminPass123!",
      role: "admin",
      mustChangePassword: false
    });
    const user = createUser(db, {
      username: "birder",
      password: "BirderPass123!",
      role: "user",
      mustChangePassword: false
    }).user;

    await withServer({ database: db, projectRoot: process.cwd() }, async ({ request }) => {
      const login = await request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "AdminPass123!" })
      });
      const adminCookie = cookieFrom(login);
      const csrf = (await json(login)).csrfToken;

      const listed = await request("/api/admin/users", { headers: { cookie: adminCookie } });
      assert.equal(listed.status, 200);

      const reset = await request(`/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { cookie: adminCookie, "x-csrf-token": csrf }
      });
      assert.equal(reset.status, 200);
      const resetBody = await json(reset);
      assert.equal(resetBody.user.mustChangePassword, true);
      assert.equal(resetBody.temporaryPassword, "123456");

      const disable = await request(`/api/admin/users/${user.id}/disable`, {
        method: "POST",
        headers: { cookie: adminCookie, "x-csrf-token": csrf }
      });
      assert.equal(disable.status, 200);
      assert.equal((await json(disable)).user.disabled, true);

      const disabledLogin = await request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "birder", password: resetBody.temporaryPassword })
      });
      assert.equal(disabledLogin.status, 401);
    });
  } finally {
    temp.cleanup();
  }
});

test("proxies BirdReport endpoints through the authenticated same-origin API", async () => {
  const temp = createTempDatabase();
  try {
    const db = initializeSiteDatabase(temp.databasePath);
    createUser(db, {
      username: "admin",
      password: "AdminPass123!",
      role: "admin",
      mustChangePassword: false
    });
    const upstreamCalls = [];

    await withServer(
      {
        database: db,
        projectRoot: process.cwd(),
        fetchImpl: async (url, init) => {
          upstreamCalls.push({ url, init });
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
      },
      async ({ request }) => {
        const login = await request("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: "admin", password: "AdminPass123!" })
        });
        const adminCookie = cookieFrom(login);

        const proxied = await request("/api/birdreport/province", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: adminCookie,
            requestId: "req-123",
            sign: "signed",
            timestamp: "1700000000000"
          },
          body: JSON.stringify({ ping: true })
        });
        assert.equal(proxied.status, 200);
        assert.deepEqual(await json(proxied), { success: true });
        assert.equal(upstreamCalls.length, 1);
        assert.equal(upstreamCalls[0].url, "https://api.birdreport.cn/front/system/adcode/province");
        assert.equal(upstreamCalls[0].init.headers.origin, "https://www.birdreport.cn");
        assert.equal(upstreamCalls[0].init.headers.requestId, "req-123");
        assert.equal(upstreamCalls[0].init.headers.sign, "signed");
        assert.equal(upstreamCalls[0].init.headers.timestamp, "1700000000000");
      }
    );
  } finally {
    temp.cleanup();
  }
});

test("proxies BirdReport captcha endpoints with the upstream cookie jar", async () => {
  const temp = createTempDatabase();
  try {
    const db = initializeSiteDatabase(temp.databasePath);
    createUser(db, {
      username: "admin",
      password: "AdminPass123!",
      role: "admin",
      mustChangePassword: false
    });
    const upstreamCalls = [];

    await withServer(
      {
        database: db,
        projectRoot: process.cwd(),
        fetchImpl: async (url, init) => {
          upstreamCalls.push({ url, init });
          if (String(url).includes("/front/code/visited/generate")) {
            return new Response(Buffer.from("captcha-image"), {
              status: 200,
              headers: {
                "content-type": "image/png",
                "set-cookie": "birdreport-captcha=session-123; Path=/; HttpOnly"
              }
            });
          }
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
      },
      async ({ request }) => {
        const login = await request("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: "admin", password: "AdminPass123!" })
        });
        const adminCookie = cookieFrom(login);

        const captcha = await request("/api/birdreport/captcha", {
          headers: { cookie: adminCookie }
        });
        assert.equal(captcha.status, 200);
        assert.equal(captcha.headers.get("content-type"), "image/png");
        assert.equal(await captcha.text(), "captcha-image");

        const verified = await request("/api/birdreport/verify", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: adminCookie },
          body: JSON.stringify({ code: "1234" })
        });
        assert.equal(verified.status, 200);
        assert.deepEqual(await json(verified), { success: true });

        assert.equal(upstreamCalls.length, 2);
        assert.match(upstreamCalls[0].url, /\/front\/code\/visited\/generate\?timestamp=\d+$/);
        assert.equal(upstreamCalls[0].init.method, "GET");
        assert.equal(upstreamCalls[1].url, "https://api.birdreport.cn/front/code/visited/verify");
        assert.equal(upstreamCalls[1].init.method, "POST");
        assert.equal(upstreamCalls[1].init.headers.cookie, "birdreport-captcha=session-123");
      }
    );
  } finally {
    temp.cleanup();
  }
});

test("rejects request bodies over the configured limit", async () => {
  const temp = createTempDatabase();
  try {
    const db = initializeSiteDatabase(temp.databasePath);
    await withServer(
      {
        database: db,
        projectRoot: process.cwd(),
        requestLimits: { maxBodyBytes: 16, bodyTimeoutMs: 15_000 }
      },
      async ({ request }) => {
        const rejected = await request("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: "admin", password: "AdminPass123!" })
        });
        assert.equal(rejected.status, 413);
        assert.equal((await json(rejected)).error, "请求体过大。");
      }
    );
  } finally {
    temp.cleanup();
  }
});

test("rate limits authenticated BirdReport proxy requests", async () => {
  const temp = createTempDatabase();
  try {
    const db = initializeSiteDatabase(temp.databasePath);
    createUser(db, {
      username: "admin",
      password: "AdminPass123!",
      role: "admin",
      mustChangePassword: false
    });
    const upstreamCalls = [];

    await withServer(
      {
        database: db,
        projectRoot: process.cwd(),
        birdreportRateLimit: { windowMs: 60_000, maxRequests: 1 },
        fetchImpl: async (url, init) => {
          upstreamCalls.push({ url, init });
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
      },
      async ({ request }) => {
        const login = await request("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: "admin", password: "AdminPass123!" })
        });
        const adminCookie = cookieFrom(login);

        const first = await request("/api/birdreport/province", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: adminCookie },
          body: JSON.stringify({ ping: true })
        });
        assert.equal(first.status, 200);

        const limited = await request("/api/birdreport/province", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: adminCookie },
          body: JSON.stringify({ ping: true })
        });
        assert.equal(limited.status, 429);
        assert.equal((await json(limited)).error, "BirdReport 请求过于频繁，请稍后再试。");
        assert.equal(upstreamCalls.length, 1);
      }
    );
  } finally {
    temp.cleanup();
  }
});

test("logout cookie includes explicit expiry for broad browser compatibility", async () => {
  const temp = createTempDatabase();
  try {
    const db = initializeSiteDatabase(temp.databasePath);
    createUser(db, {
      username: "admin",
      password: "AdminPass123!",
      role: "admin",
      mustChangePassword: false
    });

    await withServer({ database: db, projectRoot: process.cwd() }, async ({ request }) => {
      const login = await request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "AdminPass123!" })
      });
      const adminCookie = cookieFrom(login);
      const csrf = (await json(login)).csrfToken;

      const logout = await request("/api/auth/logout", {
        method: "POST",
        headers: { cookie: adminCookie, "x-csrf-token": csrf }
      });
      assert.equal(logout.status, 200);
      const setCookie = logout.headers.get("set-cookie") || "";
      assert.match(setCookie, /Max-Age=0/);
      assert.match(setCookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
    });
  } finally {
    temp.cleanup();
  }
});

test("proxies Macaulay Library search results as normalized media metadata", async () => {
  const temp = createTempDatabase();
  try {
    const db = initializeSiteDatabase(temp.databasePath);
    createUser(db, {
      username: "admin",
      password: "AdminPass123!",
      role: "admin",
      mustChangePassword: false
    });
    const upstreamCalls = [];
    const searchPayload = {
      results: {
        content: [
          {
            specimenUrl: "https://macaulaylibrary.org/asset/123456789",
            catalogId: "123456789",
            assetId: "123456789",
            mediaType: "Photo",
            mediaUrl: "https://cdn.download.ams.birds.cornell.edu/api/v1/asset/123456789/1200",
            largeUrl: "https://cdn.download.ams.birds.cornell.edu/api/v1/asset/123456789/1200",
            previewUrl: "https://cdn.download.ams.birds.cornell.edu/api/v1/asset/123456789/",
            userDisplayName: "Jane Birder",
            rating: "4.8",
            eBirdChecklistId: "S12345",
            speciesCode: "egret1",
            reportAs: "egret1",
            sciName: "Egretta garzetta",
            commonName: "Little Egret"
          }
        ]
      }
    };

    await withServer(
      {
        database: db,
        projectRoot: process.cwd(),
        fetchImpl: async (url, init) => {
          upstreamCalls.push({ url, init });
          return new Response(JSON.stringify(searchPayload), {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" }
          });
        }
      },
      async ({ request }) => {
        const login = await request("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: "admin", password: "AdminPass123!" })
        });
        const adminCookie = cookieFrom(login);

        const proxied = await request("/api/media/macaulay/search?taxonCode=egret1", {
          headers: { cookie: adminCookie }
        });
        assert.equal(proxied.status, 200);
        assert.deepEqual(await json(proxied), {
          results: [
            {
              mlId: "ML123456789",
              assetId: "123456789",
              attribution: "Jane Birder",
              rating: 4.8,
              checklistId: "S12345",
              previewUrl: "https://cdn.download.ams.birds.cornell.edu/api/v1/asset/123456789/1200",
              sourceUrl: "https://macaulaylibrary.org/asset/123456789"
            }
          ]
        });
        assert.equal(upstreamCalls[0].url, "https://media.ebird.org/api/v1/search?taxonCode=egret1&mediaType=photo&sort=rating_rank_desc&birdOnly=true&count=5");
        assert.equal(upstreamCalls[0].init.headers.accept, "application/json");
      }
    );
  } finally {
    temp.cleanup();
  }
});

test("proxies Macaulay Library assets and rejects invalid asset ids", async () => {
  const temp = createTempDatabase();
  try {
    const db = initializeSiteDatabase(temp.databasePath);
    createUser(db, {
      username: "admin",
      password: "AdminPass123!",
      role: "admin",
      mustChangePassword: false
    });
    const upstreamCalls = [];

    await withServer(
      {
        database: db,
        projectRoot: process.cwd(),
        fetchImpl: async (url, init) => {
          upstreamCalls.push({ url, init });
          return new Response(Buffer.from("jpg-bytes"), {
            status: 200,
            headers: { "content-type": "image/jpeg" }
          });
        }
      },
      async ({ request }) => {
        const login = await request("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: "admin", password: "AdminPass123!" })
        });
        const adminCookie = cookieFrom(login);

        const rejected = await request("/api/media/macaulay/asset/not-a-number", {
          headers: { cookie: adminCookie }
        });
        assert.equal(rejected.status, 400);
        assert.equal((await json(rejected)).error, "Invalid Macaulay Library asset id");

        const proxied = await request("/api/media/macaulay/asset/ML123456789", {
          headers: { cookie: adminCookie }
        });
        assert.equal(proxied.status, 200);
        assert.equal(proxied.headers.get("content-type"), "image/jpeg");
        assert.equal(await proxied.text(), "jpg-bytes");
        assert.equal(upstreamCalls[0].url, "https://cdn.download.ams.birds.cornell.edu/api/v1/asset/123456789/1200");
        assert.equal(upstreamCalls[0].init.headers.accept, "image/jpeg,image/png,image/webp");
        assert.doesNotMatch(upstreamCalls[0].init.headers.accept, /image\/avif/);
      }
    );
  } finally {
    temp.cleanup();
  }
});

test("does not serve server-side source files as static assets", async () => {
  const temp = createTempDatabase();
  try {
    const db = initializeSiteDatabase(temp.databasePath);
    createUser(db, {
      username: "admin",
      password: "AdminPass123!",
      role: "admin",
      mustChangePassword: false
    });

    await withServer({ database: db, projectRoot: process.cwd() }, async ({ request }) => {
      const login = await request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "AdminPass123!" })
      });
      const adminCookie = cookieFrom(login);

      const source = await request("/server/site/store.js", { headers: { cookie: adminCookie } });
      assert.equal(source.status, 404);
    });
  } finally {
    temp.cleanup();
  }
});

test("serves the all birds profile data and shards as static assets", async () => {
  const temp = createTempDatabase();
  try {
    writeFileSync(join(temp.dir, "all_birds_full.json"), '[{"name":"白鹭","overview":"常见涉禽。"}]', "utf8");
    mkdirSync(join(temp.dir, "data", "bird-profiles"), { recursive: true });
    writeFileSync(
      join(temp.dir, "data", "bird-profiles", "index.json"),
      '{"names":{"白鹭":{"name":"白鹭","shard":"shard-000.json","script":"shard-000.js"}}}',
      "utf8"
    );

    const db = initializeSiteDatabase(temp.databasePath);
    createUser(db, {
      username: "admin",
      password: "AdminPass123!",
      role: "admin",
      mustChangePassword: false
    });

    await withServer({ database: db, projectRoot: temp.dir }, async ({ request }) => {
      const login = await request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "AdminPass123!" })
      });
      const adminCookie = cookieFrom(login);

      const profileData = await request("/all_birds_full.json", { headers: { cookie: adminCookie } });
      assert.equal(profileData.status, 200);
      assert.equal(profileData.headers.get("content-type"), "application/json; charset=utf-8");
      assert.equal(await profileData.text(), '[{"name":"白鹭","overview":"常见涉禽。"}]');

      const shardIndex = await request("/data/bird-profiles/index.json", { headers: { cookie: adminCookie } });
      assert.equal(shardIndex.status, 200);
      assert.equal(shardIndex.headers.get("content-type"), "application/json; charset=utf-8");
      assert.equal(
        await shardIndex.text(),
        '{"names":{"白鹭":{"name":"白鹭","shard":"shard-000.json","script":"shard-000.js"}}}'
      );
    });
  } finally {
    temp.cleanup();
  }
});
