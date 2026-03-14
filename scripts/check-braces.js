const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'admin-dashboard.js');
const text = fs.readFileSync(file, 'utf8');
let stack = [];
let inSingle = false, inDouble = false, inBacktick = false, inLineComment = false, inBlockComment = false;

for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nxt = text[i + 1] || '';
    const prev = text[i - 1] || '';

    if (inLineComment) {
        if (ch === '\n') inLineComment = false;
        continue;
    }
    if (inBlockComment) {
        if (ch === '*' && nxt === '/') {
            inBlockComment = false;
            i++;
        }
        continue;
    }

    if (inSingle) {
        if (ch === "'" && prev !== '\\') inSingle = false;
        continue;
    }
    if (inDouble) {
        if (ch === '"' && prev !== '\\') inDouble = false;
        continue;
    }
    if (inBacktick) {
        if (ch === '`' && prev !== '\\') inBacktick = false;
        continue;
    }

    if (ch === '/' && nxt === '/') {
        inLineComment = true;
        i++;
        continue;
    }
    if (ch === '/' && nxt === '*') {
        inBlockComment = true;
        i++;
        continue;
    }
    if (ch === "'") { inSingle = true; continue; }
    if (ch === '"') { inDouble = true; continue; }
    if (ch === '`') { inBacktick = true; continue; }

    if ('{([['.includes(ch)) {
        stack.push({ ch, idx: i });
        continue;
    }
    if ('}])'.includes(ch)) {
        const last = stack.pop();
        const match = {'}':'{', ')':'(', ']':'['}[ch];
        if (!last || last.ch !== match) {
            console.log('Mismatch at index', i, 'char', ch, 'expected', match, 'got', last ? last.ch : null);
            // continue scanning to find additional issues
        }
    }
}

if (stack.length) {
    console.log('Unclosed delimiters at end:');
    stack.slice(-10).forEach(x => {
        const line = text.slice(0, x.idx).split(/\r?\n/).length;
        console.log(`  ${x.ch} at index ${x.idx} (line ${line})`);
    });
} else {
    console.log('Delimiters appear balanced (strings/comments ignored).');
}
