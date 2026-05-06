const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
const style = fs.readFileSync(path.join(root, "style.css"), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  !script.includes("unlocked-expand-all-toggle"),
  "top-level unlocked table toggle should be removed from the summary"
);
assert(
  !style.includes("unlocked-expand-all-toggle"),
  "top-level unlocked table toggle styles should be removed"
);
assert(
  script.includes("unlocked-floating-table-toggle"),
  "floating unlocked table toggle should remain in the module"
);
assert(
  style.includes(".unlocked-floating-actions") &&
    style.includes("position: sticky"),
  "floating unlocked table toggle should remain sticky"
);

console.log("Unlocked toggle UI contract OK");
