const { createInterface } = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const { join, resolve } = require("node:path");

const { createUser, getUserByUsername, initializeSiteDatabase } = require("./store");

function getDefaultDatabasePath() {
  return process.env.BEAUBIRD_SITE_DATABASE || join(resolve(__dirname, "..", ".."), "data", "site.sqlite");
}

function parseArgs(argv) {
  const result = { command: argv[2] || "" };
  for (let index = 3; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--username") {
      result.username = argv[index + 1];
      index += 1;
    } else if (token === "--database") {
      result.databasePath = argv[index + 1];
      index += 1;
    }
  }
  return result;
}

function runCreateAdmin(options) {
  const databasePath = options.databasePath || getDefaultDatabasePath();
  const db = initializeSiteDatabase(databasePath);
  try {
    if (getUserByUsername(db, options.username)) {
      throw new Error(`用户 ${options.username} 已存在。`);
    }
    return createUser(db, {
      username: options.username,
      password: options.password,
      role: "admin",
      mustChangePassword: false
    });
  } finally {
    db.close();
  }
}

async function promptPassword() {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const password = await rl.question("Admin password: ");
    const confirm = await rl.question("Confirm password: ");
    if (password !== confirm) {
      throw new Error("两次输入的密码不一致。");
    }
    return password;
  } finally {
    rl.close();
  }
}

async function main(argv = process.argv) {
  const args = parseArgs(argv);
  if (args.command !== "create-admin" || !args.username) {
    console.log("Usage: node server/site/cli.js create-admin --username <name> [--database data/site.sqlite]");
    process.exitCode = 1;
    return;
  }
  const password = await promptPassword();
  const result = runCreateAdmin({
    databasePath: args.databasePath || getDefaultDatabasePath(),
    password,
    username: args.username
  });
  console.log(`Created admin user: ${result.user.username}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  getDefaultDatabasePath,
  parseArgs,
  runCreateAdmin
};
