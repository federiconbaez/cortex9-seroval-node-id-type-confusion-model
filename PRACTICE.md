# Guía práctica (7 niveles)

Ejercicios **offline** sobre deserialización y confusión de tipos por id.
Nada se evalúa: el único efecto es un contador. Úsalos solo en tu máquina o
en tu propio laboratorio, nunca contra aplicaciones de terceros. Cada
respuesta está en `test/practice.test.js`.

Ayuda: `node -e "const m=require('./src/model.js'); console.log(m.run(<árbol>, 'pre'))"`.

**Básico**

1. **El camino normal.** Un `seq` genuino y un `iter` que lo referencia
   (`n01`). ¿Qué devuelve cada versión? (`OK` en las tres)
2. **Qué mira `pre`.** Un `plugin` con id nuevo como fuente de `aiter`
   (`p04`). (`NODE_TYPE_MISMATCH`: el id no tiene marca de Stream)

**Intermedio**

3. **Reutilizar un id no rastreado.** Primero un `stream` con id 3, después
   un `plugin` con el mismo id 3 como fuente (`p02`). (`pre`:
   `FOREIGN_ON_INVOKED`, 1 llamada, regla `50926b3e:L60-69`)
4. **Para qué sirve `m`.** El mismo árbol con `m: [3]` (`c01`).
   (`REUSED_ID_REJECTED` en todas)
5. **El fix.** `p02` en `post`. (`MALFORMED_NODE`, `50926b3e:L66-68`)

**Avanzado**

6. **Clave marcadora frente a clase.** Un objeto con
   `__SEROVAL_SEQUENCE__: true`: ¿cómo lo clasifica el serializador antes y
   después de 3edc78b? (`SEQUENCE_BRAND_TRUSTED` / `PLAIN_OBJECT`)
7. **La variante síncrona.** `p01`: un objeto plano detrás de un id de
   Sequence. (`pre`: `FORGED_SEQUENCE_ACCEPTED`; `post`: `MALFORMED_NODE`)

Más allá: agrega un grafo a `fixtures/cases.json` con tus etiquetas,
regenera `fixtures/expected.tsv` con `scripts/derive_expected.py` y comprueba
que el modelo, tus etiquetas y la derivación coinciden.
