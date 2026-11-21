const fs = require('fs');
const s = fs.readFileSync(process.argv[2], 'utf8');
const lineOf = (idx) => s.slice(0, idx).split('\n').length;
let stack = [];
const pairs = { ')': '(', '}': '{', ']': '[' };
let inStr = false; let strChar = '';
let inComment = false;
let i = 0;
while (i < s.length) {
  const c = s[i];
  const n = s[i + 1];
  if (inStr) { if (c === '\\') { i += 2; continue; } if (c === strChar) inStr = false; i++; continue; }
  if (inComment) { if (c === '*' && n === '/') { inComment = false; i += 2; continue; } i++; continue; }
  if (c === '/' && n === '/') { while (i < s.length && s[i] !== '\n') i++; i++; continue; }
  if (c === '/' && n === '*') { inComment = true; i += 2; continue; }
  if (c === '"' || c === "'" || c === '`') { inStr = true; strChar = c; i++; continue; }
  if ('({['.includes(c)) stack.push({ ch: c, line: lineOf(i) });
  else if ('})]'.includes(c)) { const top = stack.pop(); if (!top || top.ch !== pairs[c]) { console.log('MISMATCH closing', c, 'at line', lineOf(i), 'expected', pairs[c], 'got', top ? top.ch : 'none'); process.exit(1); } }
  i++;
}
console.log('brackets OK. unclosed openers:', stack.length);
stack.forEach(x => console.log('  unclosed', x.ch, 'at line', x.line));

// JSX tag balance
const openStack = [];
const tagRe = /<\/([A-Za-z][\w-]*)>|<([A-Za-z][\w-]*)(?:\s[\s\S]*?)?(\/?)>/g;
let m;
while ((m = tagRe.exec(s)) !== null) {
  const line = lineOf(m.index);
  if (m[1]) { // closing tag </name>
    const name = m[1];
    const top = openStack.pop();
    if (!top || top.name !== name) { console.log('JSX MISMATCH closing </' + name + '> at line', line, 'expected </' + (top ? top.name : 'none') + '>'); process.exit(1); }
  } else {
    const name = m[2];
    const selfClose = m[3] === '/';
    if (!selfClose) openStack.push({ name, line });
  }
}
console.log('JSX tags OK. unclosed tags:', openStack.length);
openStack.forEach(x => console.log('  unclosed <' + x.name + '> at line', x.line));
