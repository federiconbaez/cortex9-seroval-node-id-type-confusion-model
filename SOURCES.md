# Sources

Local copies under `security-research-45/sources/cve2026/` (not in this
repo), fetched read-only on 2026-11-09. SHA-256 re-verified against
`sources/cve2026/SHA256SUMS` when this repo was built. `Lnnn` in the code
and results are `cat -n` line numbers of these diff files.

| Source | URL | Used for | SHA-256 of copy |
|---|---|---|---|
| Commit 50926b3ee198fb757e6ce3aa70efeed38d931c8d (2026-09-28, "fix: check iterator source values instead of node ids") as `diffs/CVE-2026-116580_seroval_50926b3ee198.diff` | https://github.com/lxsmnsyc/seroval/commit/50926b3ee198fb757e6ce3aa70efeed38d931c8d | `pre` vs `post` source checks, untracked id reuse, regression-test shapes | 27fff3e88fc2c5bbad939dcee6b5ad967a8074463e838f26b12942139b14ddd9 |
| Commit 3edc78b495ea0d6bd498143e5b3e56996607c5f2 (2026-09-28, "fix: use internal classes for stream and sequence identity") as `diffs/CVE-2026-116580_seroval_3edc78b495ea.diff` | https://github.com/lxsmnsyc/seroval/commit/3edc78b495ea0d6bd498143e5b3e56996607c5f2 | marker key vs class identity (serializer axis) | f636af8ea11444a2ab9c93c367f2c502ec26509369d057b7946e2d3ba30917ad |
| GHSA-7rv5-mrxv-xcr9 (`ghsa_rec/CVE-2026-116580.json`) | https://github.com/lxsmnsyc/seroval/security/advisories/GHSA-7rv5-mrxv-xcr9 | affected `<= 1.6.7`, patched `1.6.8`, per-version notes (1.6.3 / 1.6.4 / 1.6.5-1.6.7), CWE-502 | 070cb5003968694c6736554810b78c129acecc36bd11d193937638457f1a3c5f |
| NVD CVE-2026-116580 (`nvd/CVE-2026-116580.json`, status Deferred) | https://nvd.nist.gov/vuln/detail/CVE-2026-116580 | the CVE ID exists; "Prior to 1.6.8" | d8c61fd48afc220709e59e78ba9580a31848c38499b1c0c605edf87875afbc34 |

No source contained instructions addressed to a tool or agent (grep for
injection phrases and invisible Unicode over the four files).
