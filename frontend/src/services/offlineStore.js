const DB_NAME = 'polarcore-edge';
const STORE_NAME = 'telemetry';
const QUEUE_NAME = 'sync-queue';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(QUEUE_NAME)) db.createObjectStore(QUEUE_NAME, { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readCachedTelemetry() {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get('latest');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheTelemetry(payload) {
  const db = await openDatabase();
  if (!db) return;
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).put({ ...payload, cached_at: new Date().toISOString() }, 'latest');
}

export async function queueDelta(delta) {
  const db = await openDatabase();
  if (!db) return;
  const transaction = db.transaction(QUEUE_NAME, 'readwrite');
  transaction.objectStore(QUEUE_NAME).add({ delta, queued_at: new Date().toISOString() });
}

export async function flushDeltas(api) {
  if (!navigator.onLine) return 0;
  const db = await openDatabase();
  if (!db) return 0;
  const items = await new Promise((resolve, reject) => {
    const request = db.transaction(QUEUE_NAME).objectStore(QUEUE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  if (!items.length) return 0;
  const response = await fetch(`${api}/api/sync/delta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes: items }),
  });
  if (!response.ok) throw new Error(`Delta sync failed: ${response.status}`);
  const transaction = db.transaction(QUEUE_NAME, 'readwrite');
  transaction.objectStore(QUEUE_NAME).clear();
  return items.length;
}
