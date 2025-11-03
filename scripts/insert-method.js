const fs = require("fs");
const path = require("path");
const filePath = path.resolve(process.cwd(), process.argv[2]);
const methodPath = path.resolve(process.cwd(), process.argv[3]);
const newMethod = fs.readFileSync(methodPath, "utf8");
let src = fs.readFileSync(filePath, "utf8");

const sig = "async getCurrentAlphaTrafficMetrics";
const start = src.indexOf(sig);
if (start >= 0) {
  // Replace existing method
  let braceStart = src.indexOf("{", start);
  if (braceStart === -1) {
    console.error("Opening brace not found");
    process.exit(3);
  }
  let i = braceStart, depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  if (depth !== 0) { console.error("Failed to balance braces"); process.exit(4); }
  const before = src.slice(0, start);
  const after = src.slice(i);
  src = before + newMethod + after;
} else {
  // Insert after JSDoc block for current metrics
  const marker = "Get current traffic metrics for an Alpha campaign";
  const docIdx = src.indexOf(marker);
  if (docIdx === -1) { console.error("JSDoc marker not found"); process.exit(5); }
  const endDoc = src.indexOf("*/", docIdx);
  if (endDoc === -1) { console.error("Doc end not found"); process.exit(6); }
  const insertPos = endDoc + 2;
  src = src.slice(0, insertPos) + "\n" + newMethod + "\n" + src.slice(insertPos);
}

fs.writeFileSync(filePath + ".bak_insert", src);
fs.writeFileSync(filePath, src);
console.log("Inserted/Replaced getCurrentAlphaTrafficMetrics");
