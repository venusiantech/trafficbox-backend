const fs = require('fs');
const path = require('path');
const filePath = path.resolve(process.cwd(), process.argv[2]);
const methodPath = path.resolve(process.cwd(), process.argv[3]);
const newMethod = fs.readFileSync(methodPath, 'utf8').trim();
let src = fs.readFileSync(filePath, 'utf8');

const sig = 'async getCurrentAlphaTrafficMetrics';
const start = src.indexOf(sig);
if (start === -1) {
  console.error('Signature not found');
  process.exit(2);
}
let braceStart = src.indexOf('{', start);
if (braceStart === -1) {
  console.error('Opening brace not found');
  process.exit(3);
}
let i = braceStart, depth = 0;
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
const before = src.slice(0, start);
const after = src.slice(i);
const replaced = before + newMethod + after;
fs.writeFileSync(filePath + '.bak_replace', src);
fs.writeFileSync(filePath, replaced);
console.log('Method replaced successfully');
