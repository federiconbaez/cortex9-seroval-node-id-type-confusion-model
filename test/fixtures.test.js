'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const m = require('../src/model.js');
const cases = require('../fixtures/cases.json');

const expected = new Map();
for (const line of fs.readFileSync(path.join(__dirname, '../fixtures/expected.tsv'), 'utf8')
  .trim().split('\n').slice(1)) {
  const [id, v, label, calls] = line.split('\t');
  expected.set(`${id}|${v}`, [label, Number(calls)]);
}

test('expected.tsv covers every case', () => {
  assert.equal(expected.size, cases.graphs.length * 3 + cases.serializer.length * 2);
});

for (const g of cases.graphs) {
  for (const v of m.VERSIONS) {
    test(`${g.id} ${v}: model == independent derivation == hand label`, () => {
      const r = m.run(g.tree, v);
      assert.deepEqual([r.label, r.foreignCalls], expected.get(`${g.id}|${v}`));
      assert.deepEqual([r.label, r.foreignCalls], g.expected[v]);
    });
  }
}

for (const s of cases.serializer) {
  for (const v of ['pre', 'post']) {
    test(`${s.id} ${v}: serializer identity`, () => {
      const k = m.serializerKind(m.materialize(s.value), v);
      assert.equal(k, expected.get(`${s.id}|${v}`)[0]);
      assert.equal(k, s.expected[v]);
    });
  }
}

test('acceptance: pre invokes a foreign on() for at least one positive', () => {
  const calls = cases.graphs.filter((g) => g.class === 'pos')
    .reduce((a, g) => a + m.run(g.tree, 'pre').foreignCalls, 0);
  assert.ok(calls >= 1);
});

test('acceptance: post rejects every positive and calls nothing', () => {
  for (const g of cases.graphs.filter((x) => x.class === 'pos')) {
    const r = m.run(g.tree, 'post');
    assert.equal(r.label, 'MALFORMED_NODE', g.id);
    assert.equal(r.foreignCalls, 0, g.id);
  }
});

test('acceptance: negatives identical across versions', () => {
  for (const g of cases.graphs.filter((x) => x.class === 'neg')) {
    const labels = m.VERSIONS.map((v) => m.run(g.tree, v).label);
    assert.deepEqual(labels, ['OK', 'OK', 'OK'], g.id);
  }
});

test('every non-OK decision cites a rule', () => {
  for (const g of cases.graphs) {
    for (const v of m.VERSIONS) {
      const r = m.run(g.tree, v);
      if (r.label !== 'OK') assert.match(r.rule, /^(50926b3e|3edc78b4):L\d|^advisory/);
    }
  }
});
