'use strict';
// Answers to PRACTICE.md, one test per level.
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../src/model.js');
const g = Object.fromEntries(require('../fixtures/cases.json').graphs.map((x) => [x.id, x.tree]));

test('level 1: a genuine sequence iterates in every version', () => {
  for (const v of m.VERSIONS) assert.equal(m.run(g.n01_genuine_sequence_iterator, v).label, 'OK');
});
test('level 2: pre checks the type recorded for the id', () => {
  assert.equal(m.run(g.p04_plugin_callable_fresh_id, 'pre').label, 'NODE_TYPE_MISMATCH');
});
test('level 3: reuse an untracked id', () => {
  assert.deepEqual(m.run(g.p02_plugin_callable_reuses_stream_id, 'pre'),
    { label: 'FOREIGN_ON_INVOKED', rule: '50926b3 L60-69', foreignCalls: 1 });
});
test('level 4: why m matters', () => {
  assert.equal(m.run(g.c01_tracked_id_reuse_is_guarded, 'pre').label, 'REUSED_ID_REJECTED');
});
test('level 5: the fix checks the value', () => {
  assert.equal(m.run(g.p02_plugin_callable_reuses_stream_id, 'post').label, 'MALFORMED_NODE');
});
test('level 6: brand keys vs classes', () => {
  const v = { __SEROVAL_SEQUENCE__: true, v: [1], t: 'x', d: 'x' };
  assert.equal(m.serializerKind(v, 'pre'), 'SEQUENCE_BRAND_TRUSTED');
  assert.equal(m.serializerKind(v, 'post'), 'PLAIN_OBJECT');
});
test('level 7: the sync iterator variant', () => {
  assert.equal(m.run(g.p01_plain_object_reuses_sequence_id, 'pre').label, 'FORGED_SEQUENCE_ACCEPTED');
  assert.equal(m.run(g.p01_plain_object_reuses_sequence_id, 'post').label, 'MALFORMED_NODE');
});
