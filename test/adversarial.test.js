'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const m = require('../src/model.js');

const src = fs.readFileSync(path.join(__dirname, '../src/model.js'), 'utf8');

test('model source has no eval, Function, child_process, network or fs', () => {
  for (const bad of ['eval(', 'new Function', 'child_process', "require('http",
    "require('net", "require('fs", 'process.binding', 'import(']) {
    assert.ok(!src.includes(bad), bad);
  }
});

test('malformed roots and nodes are labelled, not thrown', () => {
  for (const t of [null, 1, 'x', {}, { t: null }, { t: [] }, { t: { t: 'nope' } }]) {
    const r = m.run(t, 'pre');
    assert.equal(r.label, 'MALFORMED_INPUT');
  }
});

test('unknown version throws', () => {
  assert.throws(() => m.run({ t: { t: 'num', s: 1 } }, 'v999'));
});

test('dangling ref is rejected', () => {
  assert.equal(m.run({ t: { t: 'iter', a: [{ t: 'ref', i: 9 }] } }, 'post').label, 'UNKNOWN_REF');
});

test('prototype keys are rejected', () => {
  const t = { t: { t: 'obj', i: 0, p: JSON.parse('{"__proto__": {"t": "num", "s": 1}}') } };
  assert.equal(m.run(t, 'pre').label, 'MALFORMED_INPUT');
  assert.equal({}.polluted, undefined);
});

test('depth limit stops deep nesting', () => {
  let node = { t: 'num', s: 0 };
  for (let i = 0; i < m.MAX_DEPTH + 5; i += 1) node = { t: 'obj', i: i + 1, p: { x: node } };
  assert.equal(m.run({ t: node }, 'post').label, 'DEPTH_LIMIT');
});

test('negative and non-integer ids are rejected', () => {
  assert.equal(m.run({ t: { t: 'stream', i: -1 } }, 'pre').label, 'BAD_ID');
  assert.equal(m.run({ t: { t: 'stream', i: 1.5 } }, 'pre').label, 'BAD_ID');
});

test('iterator with wrong arity is malformed', () => {
  assert.equal(m.run({ t: { t: 'aiter', a: [] } }, 'pre').label, 'MALFORMED_INPUT');
});

test('reuse order matters: plain object first, sequence second is not a bypass in pre', () => {
  const t = { m: [], t: { t: 'obj', i: 0, p: {
    a: { t: 'iter', a: [{ t: 'obj', i: 3, p: {} }] },
    b: { t: 'seq', i: 3, a: [] } } } };
  assert.equal(m.run(t, 'pre').label, 'NODE_TYPE_MISMATCH');
});

test('a forged plain-object source with a non-function on is not called', () => {
  const t = { m: [], t: { t: 'obj', i: 0, p: {
    a: { t: 'stream', i: 3 },
    b: { t: 'aiter', a: [{ t: 'obj', i: 3, p: { on: { t: 'str', s: 'x' } } }] } } } };
  const r = m.run(t, 'pre');
  assert.equal(r.label, 'NO_ON_METHOD');
  assert.equal(r.foreignCalls, 0);
  assert.equal(m.run(t, 'post').label, 'MALFORMED_NODE');
});

test('brand key copied onto a genuine-looking object is not trusted by post', () => {
  const forged = JSON.parse('{"__SEROVAL_STREAM__": true, "on": 1}');
  assert.equal(m.serializerKind(forged, 'pre'), 'STREAM_BRAND_TRUSTED');
  assert.equal(m.serializerKind(forged, 'post'), 'PLAIN_OBJECT');
});

test('results are deterministic across two runs', () => {
  const t = require('../fixtures/cases.json').graphs[1].tree;
  assert.deepEqual(m.run(t, 'pre'), m.run(t, 'pre'));
});
