import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function sourceFiles(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await sourceFiles(full, acc);
    else if (/\.(js|mjs|html|css)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

test('the app source has no mail transport, analytics, or remote script loads', async () => {
  const files = [
    ...(await sourceFiles(path.join(root, 'src'))),
    path.join(root, 'index.html'),
  ];
  const banned = [
    { name: 'fetch', re: /\bfetch\s*\(/ },
    { name: 'XMLHttpRequest', re: /XMLHttpRequest/ },
    { name: 'WebSocket', re: /WebSocket/ },
    { name: 'sendBeacon', re: /sendBeacon/ },
    { name: 'smtp', re: /\bsmtp\b/i },
    { name: 'nodemailer', re: /nodemailer/ },
    { name: 'axios', re: /\baxios\b/ },
    { name: 'EventSource', re: /EventSource/ },
    { name: 'mail send call', re: /\.send\s*\(/ },
    { name: 'remote url', re: /https?:\/\//i },
    { name: 'innerHTML', re: /innerHTML/ },
    { name: 'template personal name', re: /Jeovanie|Claudio|Crystal M/ },
  ];
  const hits = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const ban of banned) {
      if (ban.re.test(text)) hits.push(`${path.relative(root, file)} matched ${ban.name}`);
    }
  }
  assert.deepEqual(hits, []);
});
