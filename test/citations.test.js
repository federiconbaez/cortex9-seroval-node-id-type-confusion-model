'use strict';
// Every line citation in this repo is checked against the saved diffs.
//
// Citation form everywhere: `<tag>:L<n>` or `<tag>:L<n>-<m>`, where <tag> is
// the 8-hex prefix of the fix commit. sources/diffs.tsv maps each tag to the
// saved diff copied into sources/ and its SHA-256; citations.tsv is the single
// table of cited ranges with the text each range must contain. This test
// fails on a wrong hash, a range past the end of the file, a range that does
// not contain its text, a citation in any text file that is not in the table,
// or a bare `L<n>` without a tag.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TAGGED = /\b([0-9a-f]{8}):L(\d+)(?:-(\d+))?\b/g;
const BARE = /\bL\d+\b/g;
const SKIP_DIRS = new Set(['.git', 'sources', 'node_modules', '__pycache__']);
const SKIP_FILES = new Set(['LICENSE', 'citations.test.js']);
const TEXT_EXT = new Set(['.js', '.py', '.md', '.json', '.csv', '.tsv', '.yml', '.txt', '']);

function readTsv(file) {
  const [head, ...rows] = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const cols = head.split('\t');
  return rows.map((r) => Object.fromEntries(r.split('\t').map((v, i) => [cols[i], v])));
}

const DIFFS = Object.fromEntries(readTsv(path.join(ROOT, 'sources/diffs.tsv')).map((r) => [r.tag, r]));
const ROWS = readTsv(path.join(ROOT, 'citations.tsv'));
const TABLE = new Set(ROWS.map((r) => `${r.tag}:${Number(r.start)}-${Number(r.end)}`));

function lines(tag) {
  return fs.readFileSync(path.join(ROOT, 'sources', DIFFS[tag].file), 'utf8').split('\n');
}

function* textFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* textFiles(path.join(dir, e.name));
    } else if (!SKIP_FILES.has(e.name) && TEXT_EXT.has(path.extname(e.name))) {
      yield path.join(dir, e.name);
    }
  }
}

test('saved diffs match their sha256', () => {
  assert.ok(Object.keys(DIFFS).length > 0);
  for (const [tag, r] of Object.entries(DIFFS)) {
    const data = fs.readFileSync(path.join(ROOT, 'sources', r.file));
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), r.sha256, tag);
  }
});

test('every cited range contains its text', () => {
  assert.ok(ROWS.length > 0);
  for (const r of ROWS) {
    const a = Number(r.start);
    const b = Number(r.end);
    const ls = lines(r.tag);
    const n = ls[ls.length - 1] === '' ? ls.length - 1 : ls.length;
    assert.ok(a >= 1 && a <= b && b <= n, `${r.tag}:L${a}-${b} past end (${n} lines)`);
    assert.ok(ls.slice(a - 1, b).join('\n').includes(r.expect), `${r.tag}:L${a}-${b} lacks ${r.expect}`);
  }
});

test('every citation in the repo is in the table and tagged', () => {
  let seen = 0;
  for (const f of textFiles(ROOT)) {
    const rel = path.relative(ROOT, f);
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(TAGGED)) {
      const a = Number(m[2]);
      const b = Number(m[3] || m[2]);
      seen += 1;
      assert.ok(TABLE.has(`${m[1]}:${a}-${b}`), `${rel}: ${m[0]} not in citations.tsv`);
    }
    const bare = text.replace(TAGGED, '').match(BARE);
    assert.equal(bare, null, `${rel}: untagged citation ${bare && bare[0]}`);
  }
  assert.ok(seen > 0);
});
