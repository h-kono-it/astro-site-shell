import type { FileEntry, Collection, Fs } from './types.js';

export function buildFs(pages: FileEntry[], collections: Collection[]): Fs {
  const fs: Fs = {
    '/': { dirs: collections.map(c => c.name), files: pages },
  };
  for (const col of collections) {
    fs[`/${col.name}`] = { dirs: [], files: col.entries };
  }
  return fs;
}

export function resolvePath(base: string, rel: string): string {
  if (!rel || rel === '~') return '/';
  if (rel.startsWith('/')) return rel.replace(/\/$/, '') || '/';
  const segs = base === '/' ? [] : base.split('/').filter(Boolean);
  for (const part of rel.replace(/\/$/, '').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') segs.pop();
    else segs.push(part);
  }
  return segs.length ? '/' + segs.join('/') : '/';
}

export function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function fmtDate(d: Date | string | undefined): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}
