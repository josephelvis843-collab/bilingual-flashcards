// JSON-file storage for local development without a database.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'progress.json');

async function readAll() {
  try {
    const data = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    return data.users ?? {};
  } catch (err) {
    if (err.code === 'ENOENT') return {}; // no progress saved yet
    throw err;
  }
}

export async function init() {}

export async function readKnown(userId) {
  const users = await readAll();
  return users[userId] ?? [];
}

export async function writeKnown(userId, known) {
  const users = await readAll();
  users[userId] = known;
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify({ users }, null, 2));
}
