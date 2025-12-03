import { promises as fs } from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'src', 'sensay_local_store.json');

async function readStore() {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    // If missing, return initial structure
    return { replicas: {}, training: {} };
  }
}

async function writeStore(obj) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(obj, null, 2), 'utf8');
}

export async function getStore() {
  return await readStore();
}

export async function saveStore(storeObj) {
  await writeStore(storeObj);
}