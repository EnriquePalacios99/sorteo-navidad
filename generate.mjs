// Genera el sorteo del año. Uso: node generate.mjs
// Es UNICO por año: escribe docs/sorteos/<año>.json y se niega a sobrescribirlo.
// Para el año siguiente basta volver a ejecutarlo (se crea <año+1>.json y el actual no se toca).
//
// PRIVACIDAD: el archivo publicado solo lleva el primer nombre y siglas de familia ("Juan", "Fam PeGo").
// Los nombres completos viven unicamente en participants.json (no se publica).
//
//   node generate.mjs --relabel   -> reescribe SOLO las etiquetas del sorteo existente; la asignacion no cambia.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomInt } from 'node:crypto';

const year = new Date().getFullYear();
const dir = 'docs/sorteos';
const file = `${dir}/${year}.json`;
const relabel = process.argv.includes('--relabel');

if (existsSync(file) && !relabel) {
  console.error(`\nEl sorteo ${year} ya existe (${file}) y NO se puede modificar.\nEl proximo sorteo se podra generar en ${year + 1}.`);
  process.exit(1);
}

const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cap = (w) => w[0].toUpperCase() + w.slice(1).toLowerCase();

// Solo el primer nombre: "Juan Perez Gomez" -> "Juan".
// Si hay nombres iguales en una familia o el nombre es compuesto, en participants.json se puede
// usar { "name": "Juan Carlos Perez G.", "show": "Juan Carlos" }.
const personLabel = (e) => e.show || e.name.trim().split(/\s+/)[0];
// "Familia Perez Gomez" -> "Fam PeGo"   |   "Familia de Ana Lopez" -> "Fam AnLo"
const familyLabel = (full) => 'Fam ' + full.split(/\s+/)
  .filter((w) => !['familia', 'de', 'del', 'la'].includes(w.toLowerCase()))
  .map((w) => cap(w.slice(0, 2))).join('');

const fams = JSON.parse(readFileSync('participants.json', 'utf8'));
let n = 0;
const families = Object.entries(fams).map(([family, names]) => ({
  full: family,
  label: familyLabel(family),
  people: names.map((entry) => {
    const e = typeof entry === 'string' ? { name: entry } : entry;
    return { id: 'p' + String(++n).padStart(2, '0'), full: e.name, label: personLabel(e), family };
  }),
}));
const people = families.flatMap((f) => f.people);

// Las etiquetas deben ser unicas dentro de su familia (y las familias entre si) para que nadie se confunda
const checks = [['familia', families.map((f) => f.label)], ...families.map((f) => [`persona en ${f.label}`, f.people.map((p) => p.label)])];
for (const [kind, labels] of checks) {
  const dup = labels.filter((l, i) => labels.indexOf(l) !== i);
  if (dup.length) throw new Error(`Etiquetas de ${kind} repetidas: ${[...new Set(dup)].join(', ')}`);
}

const publicFamilies = families.map((f) => ({ name: f.label, people: f.people.map((p) => ({ id: p.id, name: p.label })) }));
if (relabel) {
  const cur = JSON.parse(readFileSync(file, 'utf8'));
  const ids = people.map((p) => p.id).sort().join();
  if (Object.keys(cur.assign).sort().join() !== ids) throw new Error('participants.json ya no coincide con el sorteo existente');
  writeFileSync(file, JSON.stringify({ year: cur.year, families: publicFamilies, assign: cur.assign }, null, 1));
  console.log(`OK: etiquetas del sorteo ${cur.year} actualizadas. La asignacion NO cambio.`);
  process.exit(0);
}

// Un solo ciclo aleatorio: cada persona regala a la siguiente; consecutivos nunca son de la misma familia.
// (Garantiza que cada quien da y recibe exactamente 1, y no hay intercambios mutuos A<->B.)
let order, tries = 0;
do {
  order = shuffle(people); tries++;
} while (!order.every((p, i) => p.family !== order[(i + 1) % order.length].family) && tries < 1e6);
if (tries >= 1e6) throw new Error('No se encontro un sorteo valido');

const assign = {};
order.forEach((p, i) => (assign[p.id] = order[(i + 1) % order.length].id));

mkdirSync(dir, { recursive: true });
writeFileSync(file, JSON.stringify({ year, families: publicFamilies, assign }, null, 1), { flag: 'wx' }); // 'wx': falla si ya existe
writeFileSync(`${dir}/index.json`, JSON.stringify({ current: year }));
console.log(`OK: sorteo ${year} creado (${people.length} participantes, ${families.length} familias). Ya no se puede regenerar.`);
