// Almacen de preferencias: Firestore (nube) o localStorage (prueba local).
import { FIREBASE_CONFIG } from './config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
let impl;

async function cloud() {
  const { initializeApp } = await import(FB + 'firebase-app.js');
  const f = await import(FB + 'firebase-firestore.js');
  const db = f.getFirestore(initializeApp(FIREBASE_CONFIG));
  return {
    mode: 'cloud',
    async getAllProfiles() {
      const out = {}; (await f.getDocs(f.collection(db, 'profiles'))).forEach((d) => (out[d.id] = d.data())); return out;
    },
    async setProfile(id, data) { await f.setDoc(f.doc(db, 'profiles', id), data); },
  };
}

function local() {
  const KEY = 'sorteo_mock_db_v2';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
  return {
    mode: 'local',
    async getAllProfiles() { return load(); },
    async setProfile(id, data) { const d = load(); d[id] = data; save(d); },
  };
}

export async function getStore() {
  if (!impl) impl = FIREBASE_CONFIG ? await cloud() : local();
  return impl;
}
