// Where "known" progress is saved. Everything storage-related lives in
// this file, so swapping the JSON file for a real database later (e.g.
// Supabase) only means rewriting these two functions — the routes in
// index.js don't care how the data is stored.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', 'progress.json');

export async function readKnown() {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw).known ?? [];
  } catch (err) {
    if (err.code === 'ENOENT') return []; // no progress saved yet
    throw err;
  }
}

export async function writeKnown(known) {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify({ known }, null, 2));
}
