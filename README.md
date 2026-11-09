# cortex9-seroval-node-id-type-confusion-model

Offline, inert model of **CVE-2026-116580** (GHSA-7rv5-mrxv-xcr9, CWE-502):
seroval's `fromJSON` rebuilt an (async) iterator from a source node and, in
1.6.5-1.6.7, validated the **type recorded for the source's id** instead of
the value itself. In vanilla mode an id missing from `m` is not tracked and
can be reused, so a plain object or a plugin value could sit behind an id
marked as a Sequence or Stream, and its `on` was called. Fixed in
**seroval 1.6.8** by commits `3edc78b495ea0d6bd498143e5b3e56996607c5f2`
(class identity instead of marker keys) and
`50926b3ee198fb757e6ce3aa70efeed38d931c8d` (check the value with
`isSequence` / `isStream`).

Spanish: [README.es.md](README.es.md). Exercises: [PRACTICE.md](PRACTICE.md).

## The model

`src/model.js` is **not seroval code**. It is a reduced deserializer over a
small node format of its own (`num`, `str`, `ref`, `obj`, `seq`, `stream`,
`plugin`, `iter`, `aiter`) with three versions side by side:

| Version | Source check | From |
|---|---|---|
| `v163` | none beyond truthiness | advisory text ("up to 1.6.3 accept any value"), no diff |
| `pre` (1.6.5-1.6.7) | `validateNodeType` on the id's recorded type | 50926b3 L38 / L60 (removed), mark set at L78-79 |
| `post` (1.6.8) | `instanceof` on the value | 50926b3 L43 / L66 (added), classes 3edc78b L31-46, L95-181 |

The only sink is a **counter**: a `plugin` node returns an object whose `on`
increments `foreignCalls`. Nothing is evaluated; there is no network, file
or child-process access (checked by `test/adversarial.test.js`).

A second, smaller axis models 3edc78b's serializer identity check: an
object carrying the `__SEROVAL_SEQUENCE__` / `__SEROVAL_STREAM__` key was
trusted as internal before (L44, L179) and is a plain object after (L45,
L180). The model only classifies; it never emits code.

## Differential evidence (`results/summary.csv`)

| version | positive graphs | foreign `on` calls | forged sequence accepted | rejected | negatives OK |
|---|---|---|---|---|---|
| v163 | 4 | 3 | 1 | 0 | 4/4 |
| pre | 4 | 2 | 1 | 1 | 4/4 |
| post | 4 | 0 | 0 | 4 | 4/4 |

`p02` (plugin value reusing a Stream id) is the core case: `pre` calls the
foreign `on` (rule `50926b3 L60-69`), `post` stops with `MALFORMED_NODE`
(`50926b3 L66-68`). `c01` shows the same reuse is refused when the id is
listed in `m` (`REUSED_ID_REJECTED`).

## Run

```sh
node --test test/*.test.js
python3 scripts/derive_expected.py | diff - fixtures/expected.tsv
node scripts/gen_results.js /tmp/r && diff -r results /tmp/r
```

`fixtures/expected.tsv` comes from `scripts/derive_expected.py`, an
independent Python implementation that does not read `src/`. The model, the
hand labels in `fixtures/cases.json` and the derivation must agree. Node
20+ and Python 3.10+, no packages.

A model is not a finding. See [LIMITATIONS.md](LIMITATIONS.md) and
[SOURCES.md](SOURCES.md). License: Apache-2.0.
