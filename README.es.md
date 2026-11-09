# cortex9-seroval-node-id-type-confusion-model

Modelo offline e inerte de **CVE-2026-116580** (GHSA-7rv5-mrxv-xcr9,
CWE-502): `fromJSON` de seroval reconstruía un iterador (asíncrono) a partir
de un nodo fuente y, en 1.6.5-1.6.7, validaba el **tipo registrado para el
id** de la fuente en lugar del valor. En modo vanilla un id que no está en
`m` no se rastrea y se puede reutilizar, así que un objeto plano o un valor
de un plugin podía quedar detrás de un id marcado como Sequence o Stream, y
se llamaba a su `on`. Corregido en **seroval 1.6.8** por los commits
`3edc78b495ea0d6bd498143e5b3e56996607c5f2` (identidad por clase en vez de
claves marcadoras) y `50926b3ee198fb757e6ce3aa70efeed38d931c8d` (chequear el
valor con `isSequence` / `isStream`).

Inglés: [README.md](README.md). Ejercicios: [PRACTICE.md](PRACTICE.md).

## El modelo

`src/model.js` **no es código de seroval**: es un deserializador reducido
sobre un formato de nodos propio, con tres versiones lado a lado:

| Versión | Chequeo de la fuente | Origen |
|---|---|---|
| `v163` | solo que sea truthy | texto del advisory ("hasta 1.6.3 aceptan cualquier valor"), sin diff |
| `pre` (1.6.5-1.6.7) | `validateNodeType` sobre el tipo registrado del id | 50926b3 L38 / L60 (eliminadas), marca en L78-79 |
| `post` (1.6.8) | `instanceof` sobre el valor | 50926b3 L43 / L66 (agregadas), clases 3edc78b L31-46, L95-181 |

El único sumidero es un **contador**: un nodo `plugin` devuelve un objeto
cuyo `on` incrementa `foreignCalls`. No se evalúa nada; no hay red,
archivos ni procesos hijos (lo comprueba `test/adversarial.test.js`).

## Evidencia diferencial (`results/summary.csv`)

| versión | grafos positivos | llamadas a `on` ajeno | secuencia falsa aceptada | rechazados | negativos OK |
|---|---|---|---|---|---|
| v163 | 4 | 3 | 1 | 0 | 4/4 |
| pre | 4 | 2 | 1 | 1 | 4/4 |
| post | 4 | 0 | 0 | 4 | 4/4 |

## Uso

```sh
node --test test/*.test.js
python3 scripts/derive_expected.py | diff - fixtures/expected.tsv
node scripts/gen_results.js /tmp/r && diff -r results /tmp/r
```

`fixtures/expected.tsv` lo genera `scripts/derive_expected.py`, una
implementación independiente en Python que no lee `src/`. Node 20+ y Python
3.10+, sin paquetes.

Un modelo no es un hallazgo. Ver [LIMITATIONS.md](LIMITATIONS.md) y
[SOURCES.md](SOURCES.md). Licencia: Apache-2.0.
