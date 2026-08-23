/// <reference lib="webworker" />

import { unzipSync } from 'fflate';

interface ArchiveRequest {
  bytes: ArrayBuffer;
  fileCount: number;
  expandedBytes: number;
}

interface ArchiveEntry {
  path: string;
  bytes: Uint8Array;
}

const MAX_ARCHIVE_FILES = 1_024;
const MAX_ARCHIVE_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_ARCHIVE_EXPANDED_BYTES = 512 * 1024 * 1024;

function assertSafePath(path: string): void {
  const portable = path.replaceAll('\\', '/');
  if (!portable || portable.startsWith('/') || /^[a-z]:\//i.test(portable)
    || portable.split('/').some((segment) => segment === '..')) {
    throw new Error(`The archive contains an unsafe path: ${path || '(empty)'}.`);
  }
}

self.addEventListener('message', (event: MessageEvent<ArchiveRequest>) => {
  try {
    let { fileCount, expandedBytes } = event.data;
    const archive = unzipSync(new Uint8Array(event.data.bytes), {
      filter: (entry) => {
        assertSafePath(entry.name);
        if (entry.name.endsWith('/')) return false;
        fileCount += 1;
        expandedBytes += entry.originalSize;
        if (fileCount > MAX_ARCHIVE_FILES) throw new Error(`The archive contains more than ${MAX_ARCHIVE_FILES.toLocaleString()} files.`);
        if (entry.originalSize > MAX_ARCHIVE_ENTRY_BYTES) throw new Error(`The archive entry ${entry.name} expands beyond the 256 MB per-file limit.`);
        if (expandedBytes > MAX_ARCHIVE_EXPANDED_BYTES) throw new Error('The archive expands beyond the 512 MB interactive limit.');
        return true;
      },
    });
    const entries: ArchiveEntry[] = Object.entries(archive)
      .filter(([path, bytes]) => !path.endsWith('/') && bytes.byteLength > 0)
      .map(([path, bytes]) => ({ path, bytes }));
    self.postMessage({ ok: true, entries, fileCount, expandedBytes }, entries.map((entry) => entry.bytes.buffer));
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

export {};
