// Validiert requirements.json: JSON parst, Grundstruktur stimmt, gibt eine
// kompakte Übersicht. Exit-Code != 0 bei strukturellen Problemen, damit der
// Check auch in einer CI/Kette als Gate taugt.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'requirements.json');

const problems = [];
let data;
try {
  data = JSON.parse(readFileSync(path, 'utf8'));
} catch (err) {
  console.error(`✗ requirements.json nicht lesbar/kein gültiges JSON: ${err.message}`);
  process.exit(1);
}

const reqs = data.requirements;
if (!Array.isArray(reqs)) problems.push('requirements ist kein Array');

const ts = data.testStatus ?? {};
if (typeof ts.total !== 'number' || typeof ts.passed !== 'number') {
  problems.push('testStatus.total/passed fehlt oder ist nicht numerisch');
}

// Pro-Requirement-Checks: id vorhanden + eindeutig, status gesetzt.
const seen = new Set();
const byStatus = {};
if (Array.isArray(reqs)) {
  for (const [i, r] of reqs.entries()) {
    if (!r || typeof r.id !== 'string') { problems.push(`requirement #${i} ohne gültige id`); continue; }
    if (seen.has(r.id)) problems.push(`doppelte id: ${r.id}`);
    seen.add(r.id);
    if (!r.status) problems.push(`${r.id}: status fehlt`);
    byStatus[r.status ?? 'undefined'] = (byStatus[r.status ?? 'undefined'] ?? 0) + 1;
  }
}

const statusLine = Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—';
console.log(`requirements.json  ·  ${reqs?.length ?? 0} Requirements  (${statusLine})`);
console.log(`Teststatus         ·  ${ts.passed}/${ts.total} grün · typecheck: ${ts.typecheck ?? '?'} · Stand ${ts.lastRun ?? '?'}`);

if (problems.length) {
  console.error(`\n✗ ${problems.length} Problem(e):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('✓ Struktur ok');
