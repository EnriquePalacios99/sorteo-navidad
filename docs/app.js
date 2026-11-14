const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// quita tildes para que la busqueda funcione sin acentos (rango de marcas combinantes U+0300-U+036F)
const MARKS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
const norm = (s) => s.normalize('NFD').replace(MARKS, '').toLowerCase();

let data, byId = {};
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

function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
}

/* ==== acceso: ver el amigo secreto ==== */
// Regla: cada persona ve SU cartilla una sola vez (por dispositivo). Es un control de buena fe en el navegador.
const seenKey = (id) => `sorteo_seen_${data.year}_${id}`;
function seenGet(id) { try { return !!localStorage.getItem(seenKey(id)); } catch { return false; } }
function seenSet(id) { try { localStorage.setItem(seenKey(id), '1'); } catch {} }
const sessionViewed = new Set(); // permite voltear/desvoltear mientras no recargues la pagina
function can(id) {
  const me = getMe();
  if (!me) return false;
  return me === id && (!seenGet(me) || sessionViewed.has(me));
}
/* ==== fin acceso ==== */

const HUES = [352, 152, 212, 32, 282, 188, 44]; // un color por familia

function cardHtml(person, hue) {
  const friend = byId[data.assign[person.id]];
  const me = getMe(), see = can(person.id), mine = me === person.id;
  const badge = !me || see ? '' : mine ? '✅ ya la viste' : '🔒';
  return `
  <div class="flip ${flipped.has(person.id) ? 'flipped' : ''} ${mine ? 'mine' : ''} ${me && !see ? 'locked' : ''}" data-id="${person.id}" style="--h:${hue}">
    <div class="inner">
      <div class="face front">
        ${badge ? `<span class="lock">${badge}</span>` : ''}
        <div class="avatar">🎁</div>
        <div class="nm">${esc(person.name)}</div>
        <div class="hint">Toca para descubrir 🎁</div>
      </div>
      <div class="face back">
        ${see ? `<div class="lab">Te toca regalar a</div>
        <div class="friend-big"><div class="avatar">🎁</div><div class="friend">${esc(friend.name)}</div></div>` : '<div class="lab" style="margin-top:44px">🔒 Cartilla bloqueada</div>'}
        <div class="tap-back">Toca para volver</div>
      </div>
    </div>
  </div>`;
}

function updateStats() {
  $('statTotal').textContent = Object.keys(byId).length;
  $('statFams').textContent = data.families.length;
}

function render() {
  const q = norm($('search').value.trim());
  const cols = data.families.map((f, i) => {
    const people = f.people.filter((p) => !q || norm(p.name).includes(q) || norm(f.name).includes(q));
    const hue = HUES[i % HUES.length];
    return people.length
      ? `<section><h2 class="fam" style="--h:${hue}"><span>${esc(f.name)}</span><em>${people.length}</em></h2><div class="grid">${people.map((p) => cardHtml(p, hue)).join('')}</div></section>`
      : '';
  }).join('');
  $('board').innerHTML = cols ? `<div class="fams">${cols}</div>` : '<p class="none">No encontré ese nombre 🤔</p>';
  updateStats();
  renderCfg();
}

$('board').addEventListener('click', (e) => {
  const card = e.target.closest('.flip');
  if (!card) return;
  const id = card.dataset.id, me = getMe();
  if (!me) { toast('👆 Primero elige quién eres en ⚙️ Configuración'); location.hash = '#/config'; return; }
  if (!can(id)) {
    toast(me === id ? '✅ Ya viste tu amigo secreto. Si necesitas verlo otra vez, pídeselo al organizador.' : '🔒 Solo puedes ver tu propia cartilla.');
    return;
  }
  const on = card.classList.toggle('flipped');
  if (on) {
    flipped.add(id); confetti();
    if (me === id) { seenSet(me); sessionViewed.add(me); } // 1ra y unica vista
  } else flipped.delete(id);
});

function buildWho() {
  $('cWho').innerHTML = '<option value="">— Elige tu nombre —</option>' + data.families.map((f) =>
    `<optgroup label="${esc(f.name)}">${f.people.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
}

$('search').addEventListener('input', render);

/* ---------- configuracion del participante (recuerda quien eres en este dispositivo) ---------- */
const ME_KEY = 'sorteo_me';
function getMe() { try { const v = localStorage.getItem(ME_KEY); return v && byId[v] ? v : null; } catch { return null; } }
function setMe(id) { try { id ? localStorage.setItem(ME_KEY, id) : localStorage.removeItem(ME_KEY); } catch {} }
function renderCfg() {
  const id = $('cWho').value;
  $('cBody').classList.toggle('hidden', !id);
  if (!id || !byId[id]) return;
  $('cName').textContent = byId[id].name;
  $('cStatus').textContent = seenGet(id) ? '✅ Ya viste tu amigo secreto' : 'Aún no has visto tu amigo secreto';
  $('cStatus').className = 'cstat' + (seenGet(id) ? ' ok' : '');
}
function initCfg() {
  const me = getMe(); if (me) $('cWho').value = me;
  renderCfg();
  $('cWho').addEventListener('change', () => { setMe($('cWho').value); renderCfg(); render(); });
  $('cForget').addEventListener('click', () => { setMe(null); $('cWho').value = ''; renderCfg(); render(); toast('Listo: este dispositivo ya no te recuerda.'); });
}

/* ---------- menu y secciones ---------- */
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
  const { current } = await (await fetch('sorteos/index.json', { cache: 'no-store' })).json();
  data = await (await fetch(`sorteos/${current}.json`, { cache: 'no-store' })).json();
  data.families.forEach((f) => f.people.forEach((p) => (byId[p.id] = p)));
  $('year').textContent = data.year;
  buildWho();
  initCfg();
  render();
  route();
  loadItinerary();
})();
