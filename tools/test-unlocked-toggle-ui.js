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
  script.includes("unlocked-module-toggle"),
  "unlocked table toggle should move into the module header"
);
assert(
  !script.includes("unlocked-floating-table-toggle"),
  "floating unlocked table toggle should be removed from rendering"
);
assert(
  !style.includes(".unlocked-floating-actions") &&
    !style.includes(".unlocked-floating-table-toggle"),
  "floating unlocked table toggle styles should be removed"
);
assert(
  script.includes("unlocked-species-module") &&
    script.includes("unlocked-species-scroll"),
  "unlocked species list should render as a contained scroll module"
);
assert(
  style.includes(".unlocked-species-scroll") &&
    style.includes("overflow-y: auto") &&
    style.includes("overscroll-behavior: contain"),
  "unlocked species module should have an internal scroll region"
);

console.log("Unlocked toggle UI contract OK");
