import { getStore } from './store.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FIELDS = { likes: 'p_likes', i1: 'p_i1', i2: 'p_i2', i3: 'p_i3', size: 'p_size', no: 'p_no' };
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let data, store, profiles = {}, byId = {}, editingId = null;
const flipped = new Set();

function confetti() {
  const em = ['🎉', '🎁', '⭐', '🎄', '✨', '🎊'];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('span');
    s.className = 'confetti'; s.textContent = em[i % em.length];
    s.style.left = Math.random() * 100 + 'vw';
    s.style.animationDuration = 2 + Math.random() * 2.5 + 's';
    s.style.animationDelay = Math.random() * 0.5 + 's';
    document.body.appendChild(s); setTimeout(() => s.remove(), 5500);
  }
}

function prefsHtml(id) {
  const p = profiles[id] && profiles[id].prefs;
  const rows = p ? [['Le gusta', p.likes], ['Ideas de regalo', [p.i1, p.i2, p.i3].filter(Boolean).join('\n')],
    ['Tallas / colores', p.size], ['Prefiere que NO le regalen', p.no]].filter(([, v]) => v) : [];
  return rows.length
    ? rows.map(([k, v]) => `<div class="pref-row"><b>${k}</b><span>${esc(v)}</span></div>`).join('')
    : '<div class="empty">Aún no llena sus gustos 💡 ¡Vuelve más tarde!</div>';
}

const HUES = [352, 152, 212, 32, 282, 188, 44]; // un color por familia
// 60 avatares en 4 categorias; cada persona tiene uno distinto por defecto y puede elegir otro
const AV_CATS = [
  { name: '🎄 Navidad', list: ['🎅', '🤶', '🧑‍🎄', '🦌', '⛄', '🎄', '⭐', '🎁', '🔔', '🍪', '🧦', '❄️', '🌟', '🧝', '🕯️'] },
  { name: '🐾 Animales', list: ['🐶', '🐱', '🐰', '🦊', '🐼', '🐨', '🦁', '🐯', '🐸', '🐵', '🐧', '🦉', '🦄', '🐢', '🐙'] },
  { name: '🦸 Héroes', list: ['🦸', '🦸‍♀️', '🦸‍♂️', '🦹', '🦹‍♀️', '🥷', '🧙', '🧙‍♀️', '🧛', '🧜‍♀️', '🧚', '🧞', '🤖', '👽', '🦇'] },
  { name: '😎 Divertidos', list: ['😎', '🤠', '🥳', '🤩', '😺', '🤡', '👻', '🐲', '🦖', '🐬', '🦋', '🐝', '🌈', '🍕', '🍩'] },
];
const AVATARS = AV_CATS.flatMap((c) => c.list);
const avatarOf = (id) => (profiles[id] && profiles[id].avatar) || AVATARS[(parseInt(id.slice(1), 10) * 7) % AVATARS.length];

let aId = null, aSel = null, aCat = 0;
function renderAv() {
  $('aTabs').innerHTML = AV_CATS.map((c, i) => `<button type="button" class="atab ${i === aCat ? 'on' : ''}" data-c="${i}">${c.name}</button>`).join('');
  $('aGrid').innerHTML = AV_CATS[aCat].list.map((a) => `<button type="button" class="av ${a === aSel ? 'on' : ''}" data-a="${a}">${a}</button>`).join('');
  $('aPrev').textContent = aSel || '❔';
}
function openAvatar(pre) {
  aId = null; $('aWho').value = ''; $('aBody').classList.add('hidden'); $('aSave').classList.add('hidden');
  $('aErr').textContent = ''; $('avModal').classList.remove('hidden');
  if (pre) { $('aWho').value = pre; $('aWho').dispatchEvent(new Event('change')); }
}
const closeAv = () => $('avModal').classList.add('hidden');
$('openAvatar').addEventListener('click', () => openAvatar(getMe()));
$('aCancel').addEventListener('click', closeAv);
$('avModal').addEventListener('click', (e) => e.target === $('avModal') && closeAv());
$('aWho').addEventListener('change', () => {
  aId = $('aWho').value || null;
  $('aBody').classList.toggle('hidden', !aId); $('aSave').classList.toggle('hidden', !aId);
  if (!aId) return;
  aSel = avatarOf(aId);
  aCat = Math.max(0, AV_CATS.findIndex((c) => c.list.includes(aSel)));
  renderAv();
});
$('aTabs').addEventListener('click', (e) => { const b = e.target.closest('.atab'); if (b) { aCat = +b.dataset.c; renderAv(); } });
$('aGrid').addEventListener('click', (e) => { const b = e.target.closest('.av'); if (b) { aSel = b.dataset.a; renderAv(); } });
$('aSave').addEventListener('click', async () => {
  if (!aId) return;
  $('aSave').disabled = true;
  try {
    const rec = { ...(profiles[aId] || {}), avatar: aSel, ts: Date.now() }; // conserva los gustos ya guardados
    await store.setProfile(`${data.year}_${aId}`, rec);
    profiles[aId] = rec; closeAv(); render(); toast('✅ ¡Avatar guardado! ' + aSel);
  } catch (e) { console.error(e); $('aErr').textContent = 'No se pudo guardar. Intenta de nuevo.'; }
  $('aSave').disabled = false;
});

function cardHtml(person, hue) {
  const friend = byId[data.assign[person.id]];
  const filled = profiles[person.id] && profiles[person.id].prefs;
  return `
  <div class="flip ${flipped.has(person.id) ? 'flipped' : ''}" data-id="${person.id}" style="--h:${hue}">
    <div class="inner">
      <div class="face front">
        <div class="avatar">${avatarOf(person.id)}</div>
        <div class="nm">${esc(person.name)}</div>
        <div class="chip ${filled ? 'ok' : ''}">${filled ? '✓ gustos listos' : 'sin gustos aún'}</div>
        <div class="hint">Toca para descubrir 🎁</div>
      </div>
      <div class="face back">
        <div class="lab">Te toca regalar a</div>
        <div class="friend-row"><div class="avatar sm">${avatarOf(friend.id)}</div><div class="friend">${esc(friend.name)}</div></div>
        <div class="prefs">${prefsHtml(friend.id)}</div>
        <div class="tap-back">Toca para volver</div>
      </div>
    </div>
  </div>`;
}

function updateStats() {
  const total = Object.keys(byId).length;
  const ready = Object.keys(byId).filter((id) => profiles[id] && profiles[id].prefs).length;
  $('statTotal').textContent = total;
  $('statFams').textContent = data.families.length;
  $('statReady').textContent = `${ready}/${total}`;
  $('barFill').style.width = (total ? (ready / total) * 100 : 0) + '%';
}

function render() {
  const q = norm($('search').value.trim());
  $('board').innerHTML = data.families.map((f, i) => {
    const people = f.people.filter((p) => !q || norm(p.name).includes(q) || norm(f.name).includes(q));
    const hue = HUES[i % HUES.length];
    return people.length
      ? `<section><h2 class="fam" style="--h:${hue}"><span>${esc(f.name)}</span><em>${people.length}</em></h2><div class="grid">${people.map((p) => cardHtml(p, hue)).join('')}</div></section>`
      : '';
  }).join('') || '<p class="none">No encontré ese nombre 🤔</p>';
  updateStats();
  renderCfg();
}

$('board').addEventListener('click', (e) => {
  const card = e.target.closest('.flip');
  if (!card) return;
  const id = card.dataset.id;
  const on = card.classList.toggle('flipped');
  on ? (flipped.add(id), confetti()) : flipped.delete(id);
});

// Paso 1: elegir quien eres. Paso 2: llenar el formulario.
function buildWho() {
  const html = '<option value="">— Elige tu nombre —</option>' + data.families.map((f) =>
    `<optgroup label="${esc(f.name)}">${f.people.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
  $('mWho').innerHTML = html; $('aWho').innerHTML = html; $('cWho').innerHTML = html;
}
function openModal(pre) {
  editingId = null;
  $('mWho').value = '';
  $('mForm').classList.add('hidden');
  $('mSave').classList.add('hidden');
  $('mErr').textContent = '';
  $('modal').classList.remove('hidden');
  if (pre) { $('mWho').value = pre; $('mWho').dispatchEvent(new Event('change')); }
}
$('mWho').addEventListener('change', () => {
  editingId = $('mWho').value || null;
  $('mErr').textContent = '';
  $('mForm').classList.toggle('hidden', !editingId);
  $('mSave').classList.toggle('hidden', !editingId);
  if (!editingId) return;
  const p = (profiles[editingId] && profiles[editingId].prefs) || {};
  for (const [k, el] of Object.entries(FIELDS)) $(el).value = p[k] || '';
});
$('openPrefs').addEventListener('click', () => openModal(getMe()));
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
}
const closeModal = () => $('modal').classList.add('hidden');
$('mCancel').addEventListener('click', closeModal);
$('modal').addEventListener('click', (e) => e.target === $('modal') && closeModal());
$('mSave').addEventListener('click', async () => {
  if (!editingId) { $('mErr').textContent = 'Primero elige tu nombre.'; return; }
  const prefs = {}; for (const [k, el] of Object.entries(FIELDS)) prefs[k] = $(el).value.trim().slice(0, 500);
  $('mSave').disabled = true;
  try {
    const rec = { ...(profiles[editingId] || {}), prefs, ts: Date.now() }; // conserva el avatar elegido
    await store.setProfile(`${data.year}_${editingId}`, rec);
    profiles[editingId] = rec;
    closeModal(); render(); toast('✅ ¡Gustos guardados! Quien te regala ya puede verlos.');
  } catch (e) { console.error(e); $('mErr').textContent = 'No se pudo guardar. Intenta de nuevo.'; }
  $('mSave').disabled = false;
});

$('search').addEventListener('input', render);

/* ---------- menu y secciones ---------- */
/* ---------- configuracion del participante (recuerda quien eres en este dispositivo) ---------- */
const ME_KEY = 'sorteo_me';
function getMe() { try { const v = localStorage.getItem(ME_KEY); return v && byId[v] ? v : null; } catch { return null; } }
function setMe(id) { try { id ? localStorage.setItem(ME_KEY, id) : localStorage.removeItem(ME_KEY); } catch {} }
function renderCfg() {
  const id = $('cWho').value;
  $('cBody').classList.toggle('hidden', !id);
  if (!id || !byId[id]) return;
  const filled = profiles[id] && profiles[id].prefs;
  $('cAvatar').textContent = avatarOf(id);
  $('cName').textContent = byId[id].name;
  $('cStatus').textContent = filled ? '✓ Gustos listos' : 'Aún sin gustos';
  $('cStatus').className = 'cstat' + (filled ? ' ok' : '');
}
function initCfg() {
  const me = getMe(); if (me) $('cWho').value = me;
  renderCfg();
  $('cWho').addEventListener('change', () => { setMe($('cWho').value); renderCfg(); });
  $('cAvatarBtn').addEventListener('click', () => openAvatar($('cWho').value));
  $('cPrefsBtn').addEventListener('click', () => openModal($('cWho').value));
  $('cForget').addEventListener('click', () => { setMe(null); $('cWho').value = ''; renderCfg(); toast('Listo: este dispositivo ya no te recuerda.'); });
}

const ROUTES = ['sorteo', 'itinerario', 'config'];
function setMenu(open) { $('ddMenu').classList.toggle('hidden', !open); $('ddBtn').setAttribute('aria-expanded', String(open)); }
function route() {
  const r = location.hash.replace('#/', '');
  const name = ROUTES.includes(r) ? r : 'sorteo';
  ROUTES.forEach((n) => $('view-' + n).classList.toggle('hidden', n !== name));
  document.querySelectorAll('#ddMenu a').forEach((a) => a.classList.toggle('on', a.dataset.route === name));
  setMenu(false);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
$('ddBtn').addEventListener('click', (e) => { e.stopPropagation(); setMenu($('ddMenu').classList.contains('hidden')); });
document.addEventListener('click', () => setMenu(false));
document.addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

async function loadItinerary() {
  try {
    const it = await (await fetch('itinerario.json', { cache: 'no-store' })).json();
    if (it.aviso) { $('itiAviso').textContent = '🧪 ' + it.aviso; $('itiAviso').classList.remove('hidden'); }
    $('timeline').innerHTML = it.days.map((d) => `
      <section class="day"><h2>${esc(d.label)}</h2><div class="tl">${d.items.map((e) => `
        <div class="ev"><span class="time">${esc(e.time)}</span><div class="t">${esc(e.title)}</div>
        ${e.place ? `<div class="p">📍 ${esc(e.place)}</div>` : ''}${e.note ? `<div class="n">${esc(e.note)}</div>` : ''}</div>`).join('')}
      </div></section>`).join('');
  } catch (e) { console.error(e); $('timeline').innerHTML = '<p class="none">No se pudo cargar el itinerario.</p>'; }
}

(async () => {
  store = await getStore();
  const { current } = await (await fetch('sorteos/index.json', { cache: 'no-store' })).json();
  data = await (await fetch(`sorteos/${current}.json`, { cache: 'no-store' })).json();
  data.families.forEach((f) => f.people.forEach((p) => (byId[p.id] = p)));
  $('year').textContent = data.year;
  buildWho();
  // los gustos se guardan por año (ej. 2026_p01): cada año empieza limpio
  try {
    const all = await store.getAllProfiles();
    for (const id of Object.keys(byId)) if (all[`${data.year}_${id}`]) profiles[id] = all[`${data.year}_${id}`];
  } catch (e) { console.error(e); }
  if (store.mode === 'local') {
    $('banner').classList.remove('hidden');
    $('banner').textContent = '🧪 Modo local de prueba: los gustos solo se guardan en este navegador.';
  }
  initCfg();
  render();
  route();
  loadItinerary();
})();
