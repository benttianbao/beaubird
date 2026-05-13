const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { test } = require("node:test");

const { runCreateAdmin } = require("./cli");
const { getUserByUsername, initializeSiteDatabase, verifyPassword } = require("./store");

test("create-admin creates an administrator with a supplied password", () => {
  const dir = mkdtempSync(join(tmpdir(), "beaubird-site-cli-"));
  const databasePath = join(dir, "site.sqlite");
  const db = initializeSiteDatabase(databasePath);
  try {
    const result = runCreateAdmin({
      databasePath,
      username: "owner",
      password: "OwnerPass123!"
    });
    assert.equal(result.user.username, "owner");
    assert.equal(result.user.role, "admin");
    assert.equal(result.user.mustChangePassword, false);

    const user = getUserByUsername(db, "owner");
    assert.equal(user.role, "admin");
    assert.equal(verifyPassword("OwnerPass123!", user), true);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
