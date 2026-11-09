'use strict';
/*
 * Reduced, inert model of seroval's fromJSON handling of iterator sources
 * (CVE-2026-116580, GHSA-7rv5-mrxv-xcr9). Not seroval code: a small node
 * format of our own. The only "sink" is a counter incremented when the
 * deserializer calls an `on` that is not a genuine Stream's. Nothing is
 * evaluated and no network or file is touched.
 *
 * Versions:
 *   v163 - "<= 1.6.3 accept any value as the source" (advisory text only).
 *   pre  - 1.6.5..1.6.7: validateNodeType(id) on the type *recorded for the
 *          id* (diff 50926b3e:L38, 50926b3e:L60; mark set in 50926b3e:L78-79).
 *   post - 1.6.8: isSequence/isStream on the *value* with instanceof
 *          (diff 50926b3e:L43, 50926b3e:L66; classes from 3edc78b4:L31-46, 3edc78b4:L95-181).
 */

class Sequence {
  constructor(values, throwAt, doneAt) {
    this.v = values;
    this.t = throwAt;
    this.d = doneAt;
  }
}

class Stream {
  constructor() {
    this.listeners = 0;
  }

  on() {
    this.listeners += 1; // genuine stream: not counted as a foreign call
    return () => undefined;
  }
}

const VERSIONS = ['v163', 'pre', 'post'];

class ModelError extends Error {
  constructor(label, rule) {
    super(label);
    this.label = label;
    this.rule = rule;
  }
}

function newCtx(tree, version) {
  return {
    version,
    values: new Map(),
    types: new Map(),
    tracked: new Set(Array.isArray(tree.m) ? tree.m : []),
    foreignCalls: 0,
    forged: null,
    depth: 0,
  };
}

const MAX_DEPTH = 64;

function assign(ctx, id, value) {
  if (!Number.isInteger(id) || id < 0) {
    throw new ModelError('BAD_ID', 'model');
  }
  // guardIndexedValue only protects ids listed in `m` (diff 50926b3e:L11,
  // 50926b3e:L118-120): an untracked id can be reused silently.
  if (ctx.tracked.has(id) && ctx.values.has(id)) {
    throw new ModelError('REUSED_ID_REJECTED', '50926b3e:L36-37');
  }
  ctx.values.set(id, value);
  return value;
}

function foreignCallable(ctx) {
  return function sink() {
    ctx.foreignCalls += 1;
    return () => undefined;
  };
}

function deserialize(ctx, node) {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    throw new ModelError('MALFORMED_INPUT', 'model');
  }
  ctx.depth += 1;
  if (ctx.depth > MAX_DEPTH) {
    throw new ModelError('DEPTH_LIMIT', 'model');
  }
  try {
    return deserializeInner(ctx, node);
  } finally {
    ctx.depth -= 1;
  }
}

function deserializeInner(ctx, node) {
  switch (node.t) {
    case 'num':
    case 'str':
      return node.s;
    case 'ref':
      if (!ctx.values.has(node.i)) {
        throw new ModelError('UNKNOWN_REF', 'model');
      }
      return ctx.values.get(node.i);
    case 'obj': {
      const out = assign(ctx, node.i, {});
      for (const [k, v] of Object.entries(node.p || {})) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
          throw new ModelError('MALFORMED_INPUT', 'model');
        }
        out[k] = deserialize(ctx, v);
      }
      return out;
    }
    case 'seq': {
      const seq = assign(ctx, node.i, new Sequence([], -1, 0));
      ctx.types.set(node.i, 'Sequence'); // 50926b3e:L78-79 (removed in post)
      for (const v of node.a || []) {
        seq.v.push(deserialize(ctx, v));
      }
      seq.d = seq.v.length;
      return seq;
    }
    case 'stream': {
      const s = assign(ctx, node.i, new Stream());
      // Assumed: StreamConstructor records its type (50926b3e:L56-58 comment).
      ctx.types.set(node.i, 'StreamConstructor');
      return s;
    }
    case 'plugin': {
      // An application plugin whose deserialize returns a value with a
      // callable `on` (advisory "Impact"). `brand` copies the old marker key.
      const v = { on: foreignCallable(ctx) };
      if (node.brand) {
        v.__SEROVAL_STREAM__ = true;
      }
      return assign(ctx, node.i, v);
    }
    case 'iter':
      return iteratorFactory(ctx, node);
    case 'aiter':
      return asyncIteratorFactory(ctx, node);
    default:
      throw new ModelError('MALFORMED_INPUT', 'model');
  }
}

function sourceOf(ctx, node) {
  if (!Array.isArray(node.a) || node.a.length !== 1) {
    throw new ModelError('MALFORMED_INPUT', 'model');
  }
  return { src: deserialize(ctx, node.a[0]), srcNode: node.a[0] };
}

function iteratorFactory(ctx, node) {
  const { src, srcNode } = sourceOf(ctx, node);
  if (ctx.version === 'pre') {
    if (ctx.types.get(srcNode.i) !== 'Sequence') {
      throw new ModelError('NODE_TYPE_MISMATCH', '50926b3e:L38');
    }
  }
  if (ctx.version === 'post') {
    if (!(src instanceof Sequence)) {
      throw new ModelError('MALFORMED_NODE', '50926b3e:L43-45');
    }
    return { kind: 'iterator', values: src.v.slice() };
  }
  if (!src) {
    throw new ModelError('FALSY_SOURCE', '50926b3e:L39');
  }
  if (!(src instanceof Sequence)) {
    ctx.forged = '50926b3e:L38, 50926b3e:L46';
    return { kind: 'FORGED_SEQUENCE_ACCEPTED' };
  }
  return { kind: 'iterator', values: src.v.slice() };
}

function asyncIteratorFactory(ctx, node) {
  const { src, srcNode } = sourceOf(ctx, node);
  if (ctx.version === 'pre') {
    if (ctx.types.get(srcNode.i) !== 'StreamConstructor') {
      throw new ModelError('NODE_TYPE_MISMATCH', '50926b3e:L60');
    }
  }
  if (ctx.version === 'post' && !(src instanceof Stream)) {
    throw new ModelError('MALFORMED_NODE', '50926b3e:L66-68');
  }
  if (!src) {
    throw new ModelError('FALSY_SOURCE', '50926b3e:L61');
  }
  if (typeof src.on !== 'function') {
    throw new ModelError('NO_ON_METHOD', 'model');
  }
  src.on({ next() {}, throw() {}, return() {} }); // 50926b3e:L69: streamToAsyncIterable
  return { kind: 'async-iterator' };
}

function run(tree, version) {
  if (!VERSIONS.includes(version)) {
    throw new Error(`unknown version ${version}`);
  }
  if (tree === null || typeof tree !== 'object' || !('t' in tree)) {
    return { label: 'MALFORMED_INPUT', rule: 'model', foreignCalls: 0 };
  }
  const ctx = newCtx(tree, version);
  try {
    deserialize(ctx, tree.t);
    let label = 'OK';
    let rule = '-';
    if (ctx.forged) {
      label = 'FORGED_SEQUENCE_ACCEPTED';
      rule = ctx.version === 'pre' ? ctx.forged : 'advisory <=1.6.3';
    }
    if (ctx.foreignCalls > 0) {
      label = 'FOREIGN_ON_INVOKED';
      rule = version === 'pre' ? '50926b3e:L60-69' : 'advisory <=1.6.3';
    }
    return { label, rule, foreignCalls: ctx.foreignCalls };
  } catch (err) {
    if (err instanceof ModelError) {
      return { label: err.label, rule: err.rule, foreignCalls: ctx.foreignCalls };
    }
    throw err;
  }
}

/*
 * Serializer identity check (3edc78b): before, any object with the marker
 * key counted as a Sequence/Stream (3edc78b4:L44, 3edc78b4:L179); after, only class instances
 * (3edc78b4:L45, 3edc78b4:L180). The model only classifies; it never emits code.
 */
function serializerKind(value, version) {
  if (value instanceof Sequence) return 'SEQUENCE';
  if (value instanceof Stream) return 'STREAM';
  if (version !== 'post' && value && typeof value === 'object') {
    if ('__SEROVAL_SEQUENCE__' in value) return 'SEQUENCE_BRAND_TRUSTED';
    if ('__SEROVAL_STREAM__' in value) return 'STREAM_BRAND_TRUSTED';
  }
  return 'PLAIN_OBJECT';
}

function materialize(spec) {
  if (spec === 'genuine-sequence') return new Sequence([1, 2], -1, 2);
  if (spec === 'genuine-stream') return new Stream();
  return JSON.parse(JSON.stringify(spec));
}

module.exports = {
  VERSIONS, Sequence, Stream, run, serializerKind, materialize, MAX_DEPTH,
};
