const fs = require(''fs'');
const path = require(''path'');
const filePath = path.resolve(process.cwd(), process.argv[2]);
const newMethod = fs.readFileSync(path.resolve(process.cwd(), process.argv[3]), ''utf8'');
let src = fs.readFileSync(filePath, ''utf8'');

const sig = 'async getCurrentAlphaTrafficMetrics(campaignId)';
const startIdx = src.indexOf(sig);
if (startIdx === -1) {
  console.error('Signature not found');
  process.exit(2);
}
// Find the opening brace after signature
let braceIdx = src.indexOf('{', startIdx);
if (braceIdx === -1) {
  console.error('Opening brace not found');
  process.exit(3);
}
let i = braceIdx;
let depth = 0;
for (; i < src.length; i++) {
  const ch = src[i];
  if (ch === '{') depth++;
  else if (ch === '}') {
    depth--;
    if (depth === 0) { i++; break; }
  }
}
if (depth !== 0) {
  console.error('Failed to balance braces');
  process.exit(4);
}
const before = src.slice(0, src.lastIndexOf('function') > 0 ? startIdx : startIdx);
const after = src.slice(i);
const replaced = src.slice(0, startIdx) + newMethod + after;
fs.writeFileSync(filePath + '.bak', src, 'utf8');
fs.writeFileSync(filePath, replaced, 'utf8');
console.log('Replaced method in', filePath);
