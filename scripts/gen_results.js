'use strict';
// Regenerate results/ deterministically: node scripts/gen_results.js OUTDIR
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const m = require('../src/model.js');
const cases = require('../fixtures/cases.json');

function main(out) {
  fs.mkdirSync(out, { recursive: true });
  const rows = ['id,class,version,label,foreign_calls,rule,diff'];
  for (const g of cases.graphs) {
    for (const v of m.VERSIONS) {
      const r = m.run(g.tree, v);
      rows.push([g.id, g.class, v, r.label, r.foreignCalls, r.rule, g.diff]
        .map((x) => (String(x).includes(',') ? `"${x}"` : String(x))).join(','));
    }
  }
  fs.writeFileSync(path.join(out, 'graphs.csv'), `${rows.join('\n')}\n`);
  const ser = ['id,class,version,kind,diff'];
  for (const s of cases.serializer) {
    for (const v of ['pre', 'post']) {
      const k = m.serializerKind(m.materialize(s.value), v);
      ser.push([s.id, s.class, v, k, `"${s.diff}"`].join(','));
    }
  }
  fs.writeFileSync(path.join(out, 'serializer.csv'), `${ser.join('\n')}\n`);
  const summ = ['version,pos_graphs,pos_foreign_calls,pos_forged_accepted,pos_rejected,neg_ok'];
  for (const v of m.VERSIONS) {
    const pos = cases.graphs.filter((g) => g.class === 'pos').map((g) => m.run(g.tree, v));
    const neg = cases.graphs.filter((g) => g.class === 'neg').map((g) => m.run(g.tree, v));
    summ.push([v, pos.length,
      pos.reduce((a, r) => a + r.foreignCalls, 0),
      pos.filter((r) => r.label === 'FORGED_SEQUENCE_ACCEPTED').length,
      pos.filter((r) => !['FOREIGN_ON_INVOKED', 'FORGED_SEQUENCE_ACCEPTED'].includes(r.label)).length,
      neg.filter((r) => r.label === 'OK').length].join(','));
  }
  fs.writeFileSync(path.join(out, 'summary.csv'), `${summ.join('\n')}\n`);
  const sums = ['graphs.csv', 'serializer.csv', 'summary.csv'].map((f) => {
    const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(out, f))).digest('hex');
    return `${h}  ${f}`;
  });
  fs.writeFileSync(path.join(out, 'SHA256SUMS'), `${sums.join('\n')}\n`);
}

if (process.argv.length !== 3) {
  process.stderr.write('usage: node scripts/gen_results.js OUTDIR\n');
  process.exit(2);
}
main(process.argv[2]);
